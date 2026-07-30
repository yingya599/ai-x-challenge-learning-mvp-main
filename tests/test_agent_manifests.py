from __future__ import annotations

import json
import re


def _manifests(project_root):
    for path in sorted((project_root / "agents" / "manifests").glob("*.json")):
        yield path, json.loads(path.read_text(encoding="utf-8"))


def test_manifest_identity_and_version_are_valid(project_root):
    manifests = list(_manifests(project_root))
    assert manifests
    ids = [manifest["agent_id"] for _, manifest in manifests]
    assert len(ids) == len(set(ids))
    for path, manifest in manifests:
        assert re.fullmatch(r"\d+\.\d+\.\d+", manifest["manifest_version"]), path
        assert manifest["agent_type"] in {"student-companion", "teacher-companion", "submission-task", "review-task", "peer-review"}, path
        assert manifest["capabilities"] and manifest["interfaces"], path
        assert manifest["channel_bindings"], path


def test_manifest_nested_identifiers_are_unique(project_root):
    for path, manifest in _manifests(project_root):
        capability_ids = [item["capability_id"] for item in manifest["capabilities"]]
        permission_ids = [item["permission_id"] for item in manifest["permissions"]]
        assert len(capability_ids) == len(set(capability_ids)), path
        assert len(permission_ids) == len(set(permission_ids)), path


def test_only_submission_task_agent_can_write_submissions(project_root):
    for path, manifest in _manifests(project_root):
        scopes = {permission["scope"] for permission in manifest["permissions"]}
        if "submission:write" in scopes:
            assert manifest["agent_type"] == "submission-task", path
        if manifest["agent_type"] == "student-companion":
            assert "submission:write" not in scopes, path


def test_teacher_agents_cannot_read_student_memory(project_root):
    for path, manifest in _manifests(project_root):
        if manifest["agent_type"] == "teacher-companion":
            scopes = {permission["scope"] for permission in manifest["permissions"]}
            assert not any("student_memory" in scope and "read" in scope for scope in scopes), path


def test_trusted_agents_reference_known_agents(project_root):
    manifests = list(_manifests(project_root))
    known = {manifest["agent_id"] for _, manifest in manifests}
    for path, manifest in manifests:
        assert set(manifest["trusted_agents"]) <= known, path

