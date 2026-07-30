#!/usr/bin/env python3
"""T17.5.2: Backfill feishu_open_id from student emails via Feishu Contact API.

Run: cd ~/elite20-merge/merged && python3 scripts/t17-backfill-open-id.py

Requires contact:user.id:readonly permission. If not granted, prints the
permission URL and exits gracefully (not an error — user action required).

Idempotent: skips students that already have a feishu_open_id value.
"""
import json, urllib.request, os, sys

# ---- helpers ----

def load_env():
    env = {}
    env_file = os.path.join(os.path.dirname(__file__), "..", ".env.local")
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
    return env

env = load_env()
APP_ID = env["FEISHU_APP_ID"]
APP_SECRET = env["FEISHU_APP_SECRET"]
APP_TOKEN = env["FEISHU_APP_TOKEN"]
STU_TABLE = env["FEISHU_STUDENTS_TABLE_ID"]

PERMISSION_URL = (
    f"https://open.feishu.cn/app/{APP_ID}/auth"
    f"?q=contact:user.id:readonly"
)

def get_token():
    req = urllib.request.Request(
        "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
        data=json.dumps({"app_id": APP_ID, "app_secret": APP_SECRET}).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    resp = json.loads(urllib.request.urlopen(req).read())
    if resp.get("code") != 0:
        raise SystemExit(f"Token failed: {resp.get('msg')}")
    return resp["tenant_access_token"]

def api(method, path, body=None):
    url = f"https://open.feishu.cn/open-apis{path}"
    data = json.dumps(body).encode() if body else None
    r = urllib.request.Request(url, data=data, method=method)
    r.add_header("Authorization", f"Bearer {TOKEN}")
    r.add_header("Content-Type", "application/json; charset=utf-8")
    resp = json.loads(urllib.request.urlopen(r).read())
    return resp

def list_students():
    """Return all student records with their fields."""
    path = f"/bitable/v1/apps/{APP_TOKEN}/tables/{STU_TABLE}/records?page_size=500"
    resp = api("GET", path)
    if resp.get("code") != 0:
        raise SystemExit(f"List students failed: {resp.get('msg')}")
    return resp.get("data", {}).get("items", [])

def update_student(record_id, fields):
    path = f"/bitable/v1/apps/{APP_TOKEN}/tables/{STU_TABLE}/records/{record_id}"
    return api("PUT", path, {"fields": fields})

def batch_get_open_ids(emails):
    """Resolve emails → open_ids via Feishu Contact API.
    Returns {email: open_id}. Emails not found in the tenant are omitted."""
    resp = api("POST", "/contact/v3/users/batch_get_id", {
        "emails": emails,
    })
    code = resp.get("code", -1)
    if code == 99991663:
        # Permission not granted
        print(f"\n  ⚠️  contact:user.id:readonly 权限未开通")
        print(f"  请在飞书开放平台开通：\n  {PERMISSION_URL}\n")
        print(f"  开通后重新运行本脚本即可。")
        return None
    if code != 0:
        print(f"  ✗ batch_get_id failed: code={code} msg={resp.get('msg')}")
        return {}
    result = {}
    for item in resp.get("data", {}).get("user_list", []):
        email = item.get("email", "")
        user_id = item.get("user_id", "")
        if email and user_id:
            result[email] = user_id
    return result

# ---- main ----

print("T17.5.2: feishu_open_id backfill")
print("=" * 60)

TOKEN = get_token()
print(f"✓ Tenant token obtained")

# 1. List all students
records = list_students()
print(f"✓ Found {len(records)} student records")

# 2. Find students needing backfill
needs_backfill = []
for r in records:
    fields = r.get("fields", {})
    student_id = fields.get("学生ID", "") or fields.get("student_id", "")
    email = fields.get("邮箱", "") or fields.get("email", "")
    existing = fields.get("feishu_open_id", "")

    if isinstance(student_id, list):
        student_id = student_id[0].get("text", "") if student_id else ""
    if isinstance(email, list):
        email = email[0].get("text", "") if email else ""
    if isinstance(existing, list):
        existing = existing[0].get("text", "") if existing else ""

    existing = str(existing).strip()
    email = str(email).strip()
    student_id = str(student_id).strip()

    if existing:
        print(f"  ✓ {student_id}: already has open_id ({existing[:12]}...)")
        continue
    if not email:
        print(f"  - {student_id}: no email, skip")
        continue
    needs_backfill.append((r["record_id"], student_id, email))

if not needs_backfill:
    print(f"\n✓ All students already have feishu_open_id — nothing to do.")
    sys.exit(0)

print(f"\n{len(needs_backfill)} students need backfill:")

# 3. Resolve emails → open_ids
emails = [e for _, _, e in needs_backfill]
result = batch_get_open_ids(emails)

if result is None:
    # Permission not granted — exit gracefully
    sys.exit(0)

# 4. Write back
written = 0
for record_id, student_id, email in needs_backfill:
    open_id = result.get(email, "")
    if not open_id:
        print(f"  ✗ {student_id} ({email}): not found in tenant — skip")
        continue
    resp = update_student(record_id, {"feishu_open_id": open_id})
    if resp.get("code") == 0:
        print(f"  ✓ {student_id} ({email}): → {open_id}")
        written += 1
    else:
        print(f"  ✗ {student_id}: write failed — code={resp.get('code')} msg={resp.get('msg')}")

print(f"\n✓ Done: {written}/{len(needs_backfill)} backfilled")
