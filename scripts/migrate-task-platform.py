"""NSEAP task-platform Feishu migration.

Dry-run is the default. Use --apply only after reviewing the printed plan.
The script snapshots table schemas and records before any mutation.
It never deletes historical Challenge or Submission records.
"""
from __future__ import annotations

import argparse
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any

import requests


ROOT = Path(__file__).resolve().parents[1]
API = "https://open.feishu.cn/open-apis"


def load_env() -> None:
    env_file = ROOT / ".env.local"
    if not env_file.exists():
        return
    for raw in env_file.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


class Feishu:
    def __init__(self) -> None:
        app_id = os.environ.get("FEISHU_APP_ID")
        secret = os.environ.get("FEISHU_APP_SECRET")
        self.app_token = os.environ.get("FEISHU_APP_TOKEN", "")
        if not app_id or not secret or not self.app_token:
            raise RuntimeError("缺少 FEISHU_APP_ID / FEISHU_APP_SECRET / FEISHU_APP_TOKEN")
        response = requests.post(
            f"{API}/auth/v3/tenant_access_token/internal",
            json={"app_id": app_id, "app_secret": secret},
            timeout=30,
        )
        payload = response.json()
        if response.status_code >= 400 or payload.get("code") != 0:
            raise RuntimeError(f"飞书鉴权失败：{payload.get('msg') or response.status_code}")
        self.headers = {"Authorization": f"Bearer {payload['tenant_access_token']}", "Content-Type": "application/json"}

    def request(self, method: str, path: str, **kwargs: Any) -> dict[str, Any]:
        response = requests.request(method, f"{API}{path}", headers=self.headers, timeout=60, **kwargs)
        payload = response.json()
        if response.status_code >= 400 or payload.get("code") != 0:
            raise RuntimeError(f"飞书接口失败 {path}：{payload.get('msg') or response.status_code}")
        return payload

    def list_all(self, path: str) -> list[dict[str, Any]]:
        items: list[dict[str, Any]] = []
        token = ""
        while True:
            separator = "&" if "?" in path else "?"
            page_path = f"{path}{separator}page_size=500" + (f"&page_token={token}" if token else "")
            data = self.request("GET", page_path).get("data", {})
            items.extend(data.get("items", []))
            if not data.get("has_more"):
                return items
            token = data.get("page_token", "")

    def fields(self, table_id: str) -> list[dict[str, Any]]:
        return self.list_all(f"/bitable/v1/apps/{self.app_token}/tables/{table_id}/fields")

    def records(self, table_id: str) -> list[dict[str, Any]]:
        return self.list_all(f"/bitable/v1/apps/{self.app_token}/tables/{table_id}/records")

    def create_table(self, name: str) -> str:
        payload = self.request("POST", f"/bitable/v1/apps/{self.app_token}/tables", json={"table": {"name": name, "default_view_name": "全部"}})
        return payload["data"]["table_id"]

    def create_field(self, table_id: str, name: str, field_type: int) -> None:
        self.request("POST", f"/bitable/v1/apps/{self.app_token}/tables/{table_id}/fields", json={"field_name": name, "type": field_type})

    def create_record(self, table_id: str, fields: dict[str, Any]) -> None:
        self.request("POST", f"/bitable/v1/apps/{self.app_token}/tables/{table_id}/records", json={"fields": fields})


EXISTING_FIELDS: dict[str, list[tuple[str, int]]] = {
    "FEISHU_STUDENTS_TABLE_ID": [("部门", 1), ("岗位", 1), ("带教ID", 1), ("入职日期", 5), ("预计结束日期", 5)],
    "FEISHU_CHALLENGES_TABLE_ID": [("岗位方向", 1), ("完整说明", 1), ("证据要求JSON", 1), ("来源类型", 1)],
    "FEISHU_SUBMISSIONS_TABLE_ID": [("个人任务ID", 1), ("交付证据JSON", 1), ("成果摘要", 1)],
}

TASK_FIELDS = [
    ("个人任务ID", 1), ("任务类别ID", 1), ("岗位方向", 1), ("学生ID", 1), ("带教ID", 1), ("标题", 1),
    ("业务背景", 1), ("目标", 1), ("完整说明", 1), ("验收标准", 1), ("证据要求JSON", 1),
    ("开始时间", 5), ("截止时间", 5), ("优先级", 1), ("保密等级", 1), ("状态", 1), ("风险状态", 1),
    ("退回次数", 2), ("是否公开", 7), ("创建时间", 5), ("更新时间", 5),
]

def snapshot(client: Feishu, table_ids: dict[str, str]) -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    target = ROOT / "docs" / "migration-snapshots" / stamp
    target.mkdir(parents=True, exist_ok=False)
    for name, table_id in table_ids.items():
        if not table_id:
            continue
        data = {"table_id": table_id, "fields": client.fields(table_id), "records": client.records(table_id)}
        (target / f"{name}.json").write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    return target


def ensure_fields(client: Feishu, table_id: str, fields: list[tuple[str, int]], apply: bool) -> None:
    existing = {item.get("field_name") for item in client.fields(table_id)}
    for name, field_type in fields:
        if name in existing:
            continue
        print(f"  + 字段 {name} (type={field_type})")
        if apply:
            client.create_field(table_id, name, field_type)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="执行迁移；默认仅 dry-run")
    args = parser.parse_args()
    load_env()
    client = Feishu()
    configured = {name: os.environ.get(name, "") for name in EXISTING_FIELDS}
    print("模式：", "APPLY" if args.apply else "DRY-RUN（不会修改飞书）")
    if args.apply:
        snap = snapshot(client, configured)
        print(f"迁移前快照：{snap}")
    for env_name, fields in EXISTING_FIELDS.items():
        table_id = configured[env_name]
        if not table_id:
            print(f"- 跳过 {env_name}：未配置")
            continue
        print(f"- 检查 {env_name} ({table_id})")
        ensure_fields(client, table_id, fields, args.apply)

    tasks_id = os.environ.get("FEISHU_TASKS_TABLE_ID", "")
    if not tasks_id:
        print("- 需要创建 Tasks（个人任务）表")
    if not args.apply:
        print("\nDry-run 完成。确认上述计划后运行：python scripts/migrate-task-platform.py --apply")
        return

    if not tasks_id:
        tasks_id = client.create_table("Tasks")
        print(f"已创建 Tasks：{tasks_id}")
    ensure_fields(client, tasks_id, TASK_FIELDS, True)
    print("\n迁移完成。请把以下值写入 .env.local（不要提交该文件）：")
    print(f"FEISHU_TASKS_TABLE_ID={tasks_id}")


if __name__ == "__main__":
    main()
