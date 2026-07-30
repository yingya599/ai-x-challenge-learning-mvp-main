from __future__ import annotations

import datetime as dt

from conftest import load_json


def test_platform_content_has_supported_sections():
    content = load_json("public/platform-content.json")
    assert set(content) == {"knowledge", "docs"}
    assert content["knowledge"] and content["docs"]


def test_platform_content_records_are_complete_and_unique():
    content = load_json("public/platform-content.json")
    records = content["knowledge"] + content["docs"]
    ids = [record["id"] for record in records]
    assert len(ids) == len(set(ids))
    for record in records:
        assert all(str(record[key]).strip() for key in ("id", "title", "lastUpdated"))
        dt.date.fromisoformat(record["lastUpdated"])


def test_knowledge_and_docs_specific_fields():
    content = load_json("public/platform-content.json")
    for item in content["knowledge"]:
        assert item["type"] in {"FAQ", "教材", "最佳实践", "Prompt"}
        assert item["tags"] and all(isinstance(tag, str) and tag.strip() for tag in item["tags"])
        assert item["summary"].strip()
    for document in content["docs"]:
        assert document["category"].strip()
        assert document["author"].strip()
        assert document["content"].strip()

