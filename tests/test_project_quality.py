from __future__ import annotations

import json
import subprocess


def test_typescript_compiles(project_root):
    result = subprocess.run(
        ["npx.cmd", "tsc", "--noEmit", "--pretty", "false"],
        cwd=project_root,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=120,
    )
    assert result.returncode == 0, result.stdout + result.stderr


def test_required_npm_scripts_and_runtime_dependencies(project_root):
    package = json.loads((project_root / "package.json").read_text(encoding="utf-8"))
    assert {"dev", "build", "start"} <= package["scripts"].keys()
    assert {"next", "react", "react-dom", "zod"} <= package["dependencies"].keys()


def test_all_api_routes_export_an_http_method(project_root):
    routes = list((project_root / "app" / "api").rglob("route.ts"))
    assert routes, "No API routes were discovered"
    for route in routes:
        source = route.read_text(encoding="utf-8")
        assert any(f"export async function {method}" in source for method in ("GET", "POST", "PUT", "PATCH", "DELETE")), route


def test_admin_routes_use_centralized_authorization(project_root):
    routes = list((project_root / "app" / "api" / "admin").rglob("route.ts"))
    exempt = {
        project_root / "app" / "api" / "admin" / "preview" / "route.ts",
    }
    for route in routes:
        source = route.read_text(encoding="utf-8")
        assert "requireAdmin" in source or route in exempt, f"Missing admin guard: {route}"

