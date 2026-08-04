"""Create a completely isolated Feishu Base for local NSEAP development.

The script never reads records from, or writes records to, the currently configured
Base.  It only reuses the self-built application's credentials to create a new Base.

Dry-run (default):
    python scripts/create-isolated-test-base.py

Create the Base, tables and local seed records:
    python scripts/create-isolated-test-base.py --apply
"""
from __future__ import annotations

import argparse
import json
import os
import time
from datetime import date, timedelta
from pathlib import Path
from typing import Any

import requests


ROOT = Path(__file__).resolve().parents[1]
API = "https://open.feishu.cn/open-apis"
RESULT_FILE = ROOT / ".feishu-isolated-test-base.local.json"


def load_env() -> None:
    env_file = ROOT / ".env.local"
    for raw in env_file.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


class Feishu:
    def __init__(self) -> None:
        self.session = requests.Session()
        # On some Windows installations requests inherits a stale system proxy,
        # while Node/Next.js can reach Feishu directly.  Local setup should use
        # the direct connection so a proxy reset cannot leave a half-built Base.
        self.session.trust_env = False
        app_id = os.environ.get("FEISHU_APP_ID")
        secret = os.environ.get("FEISHU_APP_SECRET")
        if not app_id or not secret:
            raise RuntimeError("缺少 FEISHU_APP_ID / FEISHU_APP_SECRET")
        response = self.session.post(
            f"{API}/auth/v3/tenant_access_token/internal",
            json={"app_id": app_id, "app_secret": secret},
            timeout=30,
        )
        payload = response.json()
        if response.status_code >= 400 or payload.get("code") != 0:
            raise RuntimeError(f"飞书鉴权失败：{payload.get('msg') or response.status_code}")
        self.headers = {
            "Authorization": f"Bearer {payload['tenant_access_token']}",
            "Content-Type": "application/json; charset=utf-8",
        }

    def request(self, method: str, path: str, **kwargs: Any) -> dict[str, Any]:
        last_error: Exception | None = None
        for attempt in range(4):
            try:
                response = self.session.request(
                    method,
                    f"{API}{path}",
                    headers=self.headers,
                    timeout=60,
                    **kwargs,
                )
                break
            except requests.RequestException as exc:
                last_error = exc
                if attempt == 3:
                    raise RuntimeError(f"连接飞书失败（已重试 4 次）：{exc}") from exc
                time.sleep(1.5 * (attempt + 1))
        else:
            raise RuntimeError(f"连接飞书失败：{last_error}")
        try:
            payload = response.json()
        except ValueError as exc:
            raise RuntimeError(f"飞书接口返回了非 JSON 响应：HTTP {response.status_code}") from exc
        if response.status_code >= 400 or payload.get("code") != 0:
            raise RuntimeError(
                f"飞书接口失败 {method} {path}：{payload.get('msg') or response.status_code}"
            )
        time.sleep(0.06)
        return payload

    def create_base(self, name: str) -> tuple[str, str]:
        payload = self.request(
            "POST",
            "/bitable/v1/apps",
            json={"name": name, "time_zone": "Asia/Shanghai"},
        )
        app = payload.get("data", {}).get("app", {})
        token = app.get("app_token") or payload.get("data", {}).get("app_token")
        if not token:
            raise RuntimeError(f"飞书已返回成功，但未找到 app_token：{payload}")
        url = app.get("url") or f"https://feishu.cn/base/{token}"
        return str(token), str(url)

    def create_table(self, app_token: str, name: str) -> str:
        payload = self.request(
            "POST",
            f"/bitable/v1/apps/{app_token}/tables",
            json={"table": {"name": name}},
        )
        return str(payload["data"]["table_id"])

    def find_table(self, app_token: str, name: str) -> str | None:
        payload = self.request("GET", f"/bitable/v1/apps/{app_token}/tables?page_size=100")
        for item in payload.get("data", {}).get("items", []):
            if item.get("name") == name:
                return str(item.get("table_id"))
        return None

    def create_field(self, app_token: str, table_id: str, name: str, field_type: int = 1) -> None:
        self.request(
            "POST",
            f"/bitable/v1/apps/{app_token}/tables/{table_id}/fields",
            json={"field_name": name, "type": field_type},
        )

    def field_names(self, app_token: str, table_id: str) -> set[str]:
        payload = self.request(
            "GET",
            f"/bitable/v1/apps/{app_token}/tables/{table_id}/fields?page_size=100",
        )
        return {
            str(item.get("field_name", ""))
            for item in payload.get("data", {}).get("items", [])
        }

    def create_record(self, app_token: str, table_id: str, fields: dict[str, Any]) -> None:
        self.request(
            "POST",
            f"/bitable/v1/apps/{app_token}/tables/{table_id}/records",
            json={"fields": fields},
        )

    def records(self, app_token: str, table_id: str) -> list[dict[str, Any]]:
        items: list[dict[str, Any]] = []
        page_token = ""
        while True:
            suffix = f"?page_size=500" + (f"&page_token={page_token}" if page_token else "")
            payload = self.request("GET", f"/bitable/v1/apps/{app_token}/tables/{table_id}/records{suffix}")
            data = payload.get("data", {})
            items.extend(data.get("items", []))
            if not data.get("has_more"):
                return items
            page_token = str(data.get("page_token", ""))

    def delete_record(self, app_token: str, table_id: str, record_id: str) -> None:
        self.request("DELETE", f"/bitable/v1/apps/{app_token}/tables/{table_id}/records/{record_id}")


TEXT = 1
NUMBER = 2
CHECKBOX = 7
ATTACHMENT = 17

TABLES: dict[str, tuple[str, list[tuple[str, int]]]] = {
    "FEISHU_STUDENTS_TABLE_ID": ("Students", [
        ("学生ID", TEXT), ("姓名", TEXT), ("邮箱", TEXT), ("feishu_open_id", TEXT),
        ("API Key", TEXT), ("API Key Hash", TEXT), ("班级ID", TEXT),
        ("GitHub用户名", TEXT), ("GitHub主页", TEXT), ("学校", TEXT), ("专业", TEXT),
        ("年级", TEXT), ("班级/队列", TEXT), ("AI+X方向", TEXT), ("状态", TEXT),
        ("作品集链接", TEXT), ("部门", TEXT), ("岗位", TEXT), ("带教ID", TEXT),
        ("入职日期", TEXT), ("预计结束日期", TEXT), ("角色", TEXT),
    ]),
    "FEISHU_TEACHERS_TABLE_ID": ("Teachers", [
        ("teacher_id", TEXT), ("姓名", TEXT), ("email", TEXT), ("角色", TEXT),
        ("API Key", TEXT), ("API Key Hash", TEXT), ("班级ID", TEXT), ("状态", TEXT),
        ("feishu_open_id", TEXT), ("teacher_agent_id", TEXT),
    ]),
    "FEISHU_ADMINS_TABLE_ID": ("Admins", [
        ("admin_id", TEXT), ("姓名", TEXT), ("email", TEXT), ("角色", TEXT),
        ("API Key Hash", TEXT), ("状态", TEXT), ("feishu_open_id", TEXT), ("last_login_at", TEXT),
    ]),
    "FEISHU_CHALLENGES_TABLE_ID": ("Challenges", [
        ("挑战ID", TEXT), ("标题", TEXT), ("简介", TEXT), ("目标", TEXT), ("交付物", TEXT),
        ("评分标准", TEXT), ("评分维度JSON", TEXT), ("红线规则JSON", TEXT),
        ("必要交付物", TEXT), ("截止时间", TEXT), ("状态", TEXT), ("创建人", TEXT),
        ("教师ID", TEXT), ("教师AgentID", TEXT), ("飞书群ID", TEXT),
        ("Airtable记录ID", TEXT), ("本体节点", TEXT), ("学习目标", TEXT),
        ("评分标准链接", TEXT), ("技能", TEXT), ("创建时间", TEXT), ("更新时间", TEXT),
        ("GitHub仓库", TEXT), ("岗位方向", TEXT), ("完整说明", TEXT),
        ("证据要求JSON", TEXT), ("来源类型", TEXT),
    ]),
    "FEISHU_SUBMISSIONS_TABLE_ID": ("Submissions", [
        ("提交ID", TEXT), ("学生ID", TEXT), ("挑战ID", TEXT), ("个人任务ID", TEXT),
        ("学生姓名", TEXT), ("项目标题", TEXT), ("项目摘要", TEXT), ("成果摘要", TEXT),
        ("GitHub仓库链接", TEXT), ("GitHub仓库", TEXT), ("GitHub分支", TEXT),
        ("GitHub提交", TEXT), ("README链接", TEXT), ("演示链接", TEXT),
        ("AAR复盘", TEXT), ("自评文本", TEXT), ("交付证据JSON", TEXT),
        ("提交文件", TEXT), ("提交时间", TEXT), ("更新时间", TEXT),
        ("GitHub检查状态", TEXT), ("GitHub检查结果", TEXT), ("README是否存在", CHECKBOX),
        ("最新提交时间", TEXT), ("是否公开", CHECKBOX), ("状态", TEXT),
        ("任务状态", TEXT), ("评审状态", TEXT), ("路由状态", TEXT),
        ("评审模式", TEXT), ("系统校验状态", TEXT), ("反馈链接", TEXT),
        ("提交者AgentID", TEXT), ("处理者AgentID", TEXT), ("提交TaskAgentID", TEXT),
        ("学生飞书BotID", TEXT), ("管理员身份模式", TEXT), ("管理员用户ID", TEXT),
        ("提交请求ID", TEXT), ("审计日志链接", TEXT), ("路由到教师AgentID", TEXT),
        ("路由到同伴AgentID", TEXT), ("自评链接", TEXT), ("使用技能", TEXT),
        ("使用本体节点", TEXT), ("成果附件", ATTACHMENT),
    ]),
    "FEISHU_EVALUATIONS_TABLE_ID": ("Evaluations", [
        ("评价ID", TEXT), ("提交ID", TEXT), ("学生ID", TEXT), ("挑战ID", TEXT),
        ("评价类型", TEXT), ("评价人ID", TEXT), ("评价人", TEXT), ("分数", NUMBER),
        ("总分", NUMBER), ("等级", TEXT), ("分项分数JSON", TEXT), ("优点", TEXT),
        ("不足", TEXT), ("风险", TEXT), ("建议", TEXT), ("反馈", TEXT),
        ("评价时间", TEXT), ("创建时间", TEXT), ("能力评价JSON", TEXT),
    ]),
    "FEISHU_PORTFOLIO_TABLE_ID": ("PortfolioItems", [
        ("作品ID", TEXT), ("学生ID", TEXT), ("学生姓名", TEXT), ("提交ID", TEXT),
        ("标题", TEXT), ("类型", TEXT), ("摘要", TEXT), ("公开描述", TEXT),
        ("GitHub链接", TEXT), ("演示链接", TEXT), ("封面图链接", TEXT),
        ("技能", TEXT), ("AI反馈摘要", TEXT), ("是否公开", CHECKBOX), ("创建时间", TEXT),
    ]),
    "FEISHU_AUDITLOGS_TABLE_ID": ("AuditLogs", [
        ("审计ID", TEXT), ("操作时间", TEXT), ("Agent ID", TEXT), ("操作类型", TEXT),
        ("目标资源", TEXT), ("关联消息ID", TEXT), ("操作前状态", TEXT),
        ("操作后状态", TEXT), ("附加元数据", TEXT),
    ]),
    "FEISHU_INBOX_TABLE_ID": ("InboxQueue", [
        ("消息ID", TEXT), ("消息类型", TEXT), ("消息内容", TEXT), ("状态", TEXT),
        ("创建时间", TEXT), ("更新时间", TEXT),
    ]),
    "FEISHU_SYSTEM_CONFIG_TABLE_ID": ("SystemConfig", [
        ("key", TEXT), ("ciphertext", TEXT), ("nonce", TEXT), ("tag", TEXT),
        ("key_version", NUMBER), ("hint", TEXT), ("updated_at", TEXT), ("updated_by", TEXT),
    ]),
    "FEISHU_TASKS_TABLE_ID": ("Tasks", [
        ("个人任务ID", TEXT), ("任务类别ID", TEXT), ("岗位方向", TEXT),
        ("学生ID", TEXT), ("带教ID", TEXT), ("标题", TEXT), ("业务背景", TEXT),
        ("目标", TEXT), ("完整说明", TEXT), ("验收标准", TEXT), ("证据要求JSON", TEXT),
        ("开始时间", TEXT), ("截止时间", TEXT), ("优先级", TEXT), ("保密等级", TEXT),
        ("状态", TEXT), ("风险状态", TEXT), ("退回次数", NUMBER),
        ("是否公开", CHECKBOX), ("创建时间", TEXT), ("更新时间", TEXT),
        ("原始任务描述", TEXT), ("AI澄清问题", TEXT), ("AI任务拆解", TEXT),
        ("AI生成模式", TEXT), ("AI更新时间", TEXT),
        ("任务配置JSON", TEXT),
    ]),
}

CATEGORY_SEEDS = {
    "business_analysis": ["经营收入预测", "经营结果分析", "专题问题诊断", "市场与竞品分析", "经营指标看板", "策略建议与汇报"],
    "data_analysis": ["数据清洗与质量检查", "指标口径建设", "探索性数据分析", "实验与效果评估", "预测或分类分析", "数据看板与自动化"],
    "quant": ["市场数据处理", "因子研究", "策略回测", "风险收益分析", "组合优化", "量化研究报告"],
}


def seed(client: Feishu, app_token: str, ids: dict[str, str]) -> None:
    today = date.today()
    class_id = "NSEAP-LOCAL"
    teachers = [
        {"teacher_id": "TEST-LEADER-LOCAL", "姓名": "测试领导-本地", "角色": "leader", "班级ID": class_id, "状态": "active"},
        {"teacher_id": "TEST-MENTOR-LOCAL", "姓名": "测试带教-本地", "角色": "mentor", "班级ID": class_id, "状态": "active"},
        {"teacher_id": "TEST-MENTOR-02", "姓名": "测试带教-02", "角色": "mentor", "班级ID": class_id, "状态": "active"},
    ]
    students = [
        {"学生ID": "TEST-INTERN-LOCAL", "姓名": "测试实习生-本地", "班级ID": class_id, "状态": "active", "部门": "经营分析部", "岗位": "商业分析实习生", "AI+X方向": "business_analysis", "带教ID": "TEST-MENTOR-LOCAL", "学校": "本地测试大学", "专业": "工商管理", "入职日期": str(today - timedelta(days=18)), "预计结束日期": str(today + timedelta(days=72))},
        {"学生ID": "TEST-INTERN-DATA", "姓名": "测试实习生-数据", "班级ID": class_id, "状态": "active", "部门": "数据分析部", "岗位": "数据分析实习生", "AI+X方向": "data_analysis", "带教ID": "TEST-MENTOR-LOCAL", "学校": "本地测试大学", "专业": "统计学", "入职日期": str(today - timedelta(days=12)), "预计结束日期": str(today + timedelta(days=78))},
        {"学生ID": "TEST-INTERN-QUANT", "姓名": "测试实习生-量化", "班级ID": class_id, "状态": "active", "部门": "量化研究部", "岗位": "量化实习生", "AI+X方向": "quant", "带教ID": "TEST-MENTOR-02", "学校": "本地测试大学", "专业": "金融工程", "入职日期": str(today - timedelta(days=9)), "预计结束日期": str(today + timedelta(days=81))},
    ]
    teacher_table = ids["FEISHU_TEACHERS_TABLE_ID"]
    student_table = ids["FEISHU_STUDENTS_TABLE_ID"]
    challenge_table = ids["FEISHU_CHALLENGES_TABLE_ID"]
    expected_teacher_ids = {item["teacher_id"] for item in teachers}
    expected_student_ids = {item["学生ID"] for item in students}
    expected_category_ids = {f"cat-local-{index:02d}" for index in range(1, 19)}

    def dedupe(table_id: str, field_name: str, expected_ids: set[str]) -> set[str]:
        seen: set[str] = set()
        for record in client.records(app_token, table_id):
            value = str(record.get("fields", {}).get(field_name, ""))
            if value not in expected_ids:
                continue
            if value in seen:
                client.delete_record(app_token, table_id, str(record["record_id"]))
                print(f"  - 已清理重复测试记录：{value}")
            else:
                seen.add(value)
        return seen

    existing_teachers = dedupe(teacher_table, "teacher_id", expected_teacher_ids)
    existing_students = dedupe(student_table, "学生ID", expected_student_ids)
    existing_categories = dedupe(challenge_table, "挑战ID", expected_category_ids)
    for item in teachers:
        if item["teacher_id"] not in existing_teachers:
            client.create_record(app_token, teacher_table, item)
    for item in students:
        if item["学生ID"] not in existing_students:
            client.create_record(app_token, student_table, item)
    counter = 1
    for direction, titles in CATEGORY_SEEDS.items():
        for title in titles:
            category_id = f"cat-local-{counter:02d}"
            if category_id not in existing_categories:
                client.create_record(app_token, challenge_table, {
                "挑战ID": category_id,
                "标题": title,
                "简介": f"{title}的标准任务类别模板",
                "岗位方向": direction,
                "完整说明": "由带教结合真实业务背景填写个人任务要求。",
                "证据要求JSON": json.dumps([{"type": "document", "label": "成果文档", "required": True}], ensure_ascii=False),
                "来源类型": "business",
                "状态": "published",
                "创建时间": today.isoformat(),
                "更新时间": today.isoformat(),
            })
            counter += 1


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="创建隔离测试库；默认只展示计划")
    parser.add_argument("--repair-seeds", action="store_true", help="清理重复测试数据并补齐缺失数据")
    parser.add_argument("--ensure-schema", action="store_true", help="为已创建的隔离测试库补齐字段")
    args = parser.parse_args()
    load_env()

    print("隔离原则：不会读取或修改当前 FEISHU_APP_TOKEN 指向的多维表。")
    print(f"计划创建：1 个独立 Base、{len(TABLES)} 张业务表、3 名测试实习生、3 个测试管理账号、18 个任务类别。")
    if not args.apply:
        print("当前为 DRY-RUN。确认后使用 --apply 执行。")
        return

    client = Feishu()
    if RESULT_FILE.exists():
        result = json.loads(RESULT_FILE.read_text(encoding="utf-8"))
        if result.get("complete"):
            ids = {key: str(result[key]) for key in TABLES}
            if args.ensure_schema:
                for env_key, (_, fields) in TABLES.items():
                    existing_fields = client.field_names(str(result["FEISHU_APP_TOKEN"]), ids[env_key])
                    for field_name, field_type in fields:
                        if field_name not in existing_fields:
                            client.create_field(str(result["FEISHU_APP_TOKEN"]), ids[env_key], field_name, field_type)
                            print(f"  + 已补充字段：{field_name}")
            if args.repair_seeds:
                seed(client, str(result["FEISHU_APP_TOKEN"]), ids)
                print(f"隔离测试数据已校正：{result.get('base_url')}")
            elif args.ensure_schema:
                print(f"隔离测试库字段已补齐：{result.get('base_url')}")
            else:
                print(f"隔离测试库已经创建完成：{result.get('base_url')}")
            return
        base_name = str(result["base_name"])
        app_token = str(result["FEISHU_APP_TOKEN"])
        url = str(result["base_url"])
        ids = dict(result.get("table_ids", {}))
        print(f"继续上次未完成的创建任务：{url}")
    else:
        base_name = f"NSEAP 本地隔离测试库 {date.today().isoformat()}"
        app_token, url = client.create_base(base_name)
        ids: dict[str, str] = {}
        result = {
            "complete": False,
            "seeded": False,
            "base_name": base_name,
            "base_url": url,
            "FEISHU_APP_TOKEN": app_token,
            "table_ids": ids,
        }
        RESULT_FILE.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"已创建独立 Base：{base_name}")
        print(f"Base URL：{url}")

    for env_key, (table_name, fields) in TABLES.items():
        table_id = ids.get(env_key)
        if not table_id:
            table_id = client.find_table(app_token, table_name) or client.create_table(app_token, table_name)
            ids[env_key] = table_id
            result["table_ids"] = ids
            RESULT_FILE.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"- {table_name}: {table_id}（{len(fields)} 个字段）")
        existing_fields = client.field_names(app_token, table_id)
        for field_name, field_type in fields:
            if field_name not in existing_fields:
                client.create_field(app_token, table_id, field_name, field_type)

    if not result.get("seeded"):
        seed(client, app_token, ids)
        result["seeded"] = True
        RESULT_FILE.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    result.update({
        **ids,
        "complete": True,
        "test_accounts": [
            {"role": "leader", "id": "TEST-LEADER-LOCAL", "name": "测试领导-本地"},
            {"role": "mentor", "id": "TEST-MENTOR-LOCAL", "name": "测试带教-本地"},
            {"role": "mentor", "id": "TEST-MENTOR-02", "name": "测试带教-02"},
            {"role": "student", "id": "TEST-INTERN-LOCAL", "name": "测试实习生-本地"},
            {"role": "student", "id": "TEST-INTERN-DATA", "name": "测试实习生-数据"},
            {"role": "student", "id": "TEST-INTERN-QUANT", "name": "测试实习生-量化"},
        ],
    })
    RESULT_FILE.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"结果已保存到仅本地文件：{RESULT_FILE.name}")
    print("创建完成；下一步把这些新 ID 写入 .env.local 后重启本地服务。")


if __name__ == "__main__":
    main()
