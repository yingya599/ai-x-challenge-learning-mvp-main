from __future__ import annotations

import json
import pytest

from conftest import http_request, load_json


pytestmark = pytest.mark.integration


def test_public_home_page_is_served(live_server):
    status, headers, body = http_request(live_server, "/")
    assert status == 200
    assert "text/html" in headers["content-type"]
    assert b"NSEAP" in body


def test_protected_page_redirects_anonymous_user_to_login(live_server):
    status, headers, _ = http_request(live_server, "/dashboard")
    assert status in {307, 308}
    assert headers["location"].endswith("/login?next=%2Fdashboard")


def test_platform_content_api_matches_source_file(live_server):
    status, headers, body = http_request(live_server, "/api/platform-content")
    assert status == 200
    assert "application/json" in headers["content-type"]
    assert json.loads(body) == load_json("public/platform-content.json")


@pytest.mark.parametrize("path", ["/api/auth/me", "/api/health", "/api/submissions", "/api/students"])
def test_private_get_endpoints_reject_anonymous_requests(live_server, path):
    status, _, body = http_request(live_server, path)
    payload = json.loads(body)
    assert status == 401
    assert payload["ok"] is False


@pytest.mark.parametrize(
    ("path", "body"),
    [("/api/submit", {}), ("/api/challenges", {}), ("/api/github/check", {})],
)
def test_private_post_endpoints_reject_anonymous_requests(live_server, path, body):
    status, _, response_body = http_request(live_server, path, "POST", body)
    payload = json.loads(response_body)
    assert status in {401, 403}
    assert payload["ok"] is False


def test_logout_is_idempotent_and_expires_session_cookie(live_server):
    status, headers, body = http_request(live_server, "/api/auth/logout", "POST")
    assert status == 200
    assert json.loads(body) == {"ok": True}
    cookie = headers["set-cookie"]
    assert "nseap_session=" in cookie
    assert "Max-Age=0" in cookie
