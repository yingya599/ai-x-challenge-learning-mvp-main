from __future__ import annotations

import json
import os
import socket
import subprocess
import time
import urllib.error
import urllib.request
from pathlib import Path

import pytest


PROJECT_ROOT = Path(__file__).resolve().parents[1]


def load_json(relative_path: str):
    with (PROJECT_ROOT / relative_path).open(encoding="utf-8") as file:
        return json.load(file)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, file_pointer, code, message, headers, new_url):
        return None


def http_request(base_url: str, path: str, method: str = "GET", body=None, *, timeout=60):
    data = None if body is None else json.dumps(body).encode("utf-8")
    request = urllib.request.Request(
        f"{base_url}{path}",
        data=data,
        method=method,
        headers={"Content-Type": "application/json"},
    )
    opener = urllib.request.build_opener(NoRedirect())
    try:
        response = opener.open(request, timeout=timeout)
    except urllib.error.HTTPError as error:
        response = error
    raw = response.read()
    headers = {name.lower(): value for name, value in response.headers.items()}
    return response.status, headers, raw


@pytest.fixture(scope="session")
def project_root() -> Path:
    return PROJECT_ROOT


@pytest.fixture(scope="session")
def live_server(project_root: Path):
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]

    env = os.environ.copy()
    env["NEXT_DIST_DIR"] = ".next-pytest"
    process = subprocess.Popen(
        ["node", "node_modules/next/dist/bin/next", "dev", "-H", "127.0.0.1", "-p", str(port)],
        cwd=project_root,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    base_url = f"http://127.0.0.1:{port}"
    deadline = time.monotonic() + 90
    output = []
    try:
        while time.monotonic() < deadline:
            if process.poll() is not None:
                output.append(process.stdout.read() if process.stdout else "")
                pytest.fail("Next.js server exited during startup:\n" + "".join(output))
            try:
                status, _, _ = http_request(base_url, "/api/auth/me")
                if status in {200, 401}:
                    break
            except (OSError, urllib.error.URLError):
                time.sleep(0.25)
        else:
            pytest.fail("Next.js server did not become ready within 90 seconds")
        yield base_url
    finally:
        process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)
