#!/usr/bin/env python3
"""T15: Feishu table setup — idempotent script.
Run: cd ~/elite20-merge/merged && python3 scripts/t15-feishu-setup.py
Adds task_state to Submissions, feishu_open_id to Students, lists dirty records.
"""
import json, urllib.request, os, sys

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
app_id = env["FEISHU_APP_ID"]
app_secret=env["FEISHU_APP_SECRET"]
app_token = env["FEISHU_APP_TOKEN"]
sub_table = env["FEISHU_SUBMISSIONS_TABLE_ID"]
stu_table = env["FEISHU_STUDENTS_TABLE_ID"]

token_req = urllib.request.Request(
    "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
    data=json.dumps({"app_id": app_id, "app_secret": app_secret}).encode(),
    headers={"Content-Type": "application/json"}, method="POST")
token = json.loads(urllib.request.urlopen(token_req).read())["tenant_access_token"]

def api(method, path, body=None):
    url = f"https://open.feishu.cn/open-apis{path}"
    data = json.dumps(body).encode() if body else None
    r = urllib.request.Request(url, data=data, method=method)
    r.add_header("Authorization", f"Bearer {token}")
    r.add_header("Content-Type", "application/json; charset=utf-8")
    return json.loads(urllib.request.urlopen(r).read())

def get_fields(table_id):
    return {f["field_name"]: f for f in api("GET",
        f"/bitable/v1/apps/{app_token}/tables/{table_id}/fields").get("data", {}).get("items", [])}

def ensure_field(table_id, field_name, field_type=1):
    existing = get_fields(table_id)
    if field_name in existing:
        print(f"  ✓ {field_name} already exists")
        return
    print(f"  Adding {field_name}...")
    res = api("POST", f"/bitable/v1/apps/{app_token}/tables/{table_id}/fields",
        {"field_name": field_name, "type": field_type})
    if res.get("code") == 0:
        print(f"  ✓ Added")
    else:
        print(f"  ✗ Failed: {res.get('msg')}")

def find_dirty(table_id, id_field="学生ID"):
    """Find records with empty id_field."""
    dirty = []
    recs = api("GET", f"/bitable/v1/apps/{app_token}/tables/{table_id}/records?page_size=500")
    for r in recs.get("data", {}).get("items", []):
        flds = r.get("fields", {})
        val = flds.get(id_field, "")
        if isinstance(val, list): val = val[0].get("text", "") if val else ""
        if not str(val).strip():
            dirty.append(r["record_id"])
    return dirty

print("T15: Feishu table setup")
print("=" * 60)

print("\n1. Ensure task_state on Submissions")
ensure_field(sub_table, "task_state", 1)

print("\n2. Ensure feishu_open_id on Students")
ensure_field(stu_table, "feishu_open_id", 1)

print("\n3. Check dirty records")
dirty_subs = find_dirty(sub_table)
dirty_stus = find_dirty(stu_table)
print(f"  Dirty Submissions: {len(dirty_subs)} ({', '.join(dirty_subs) if dirty_subs else 'none'})")
print(f"  Dirty Students:    {len(dirty_stus)} ({', '.join(dirty_stus) if dirty_stus else 'none'})")

if "--clean" in sys.argv:
    print("\n4. Cleaning dirty records...")
    for rid in dirty_subs:
        res = api("DELETE", f"/bitable/v1/apps/{app_token}/tables/{sub_table}/records/{rid}")
        print(f"  Sub {rid}: {'✓' if res.get('code')==0 else '✗'}")
    for rid in dirty_stus:
        res = api("DELETE", f"/bitable/v1/apps/{app_token}/tables/{stu_table}/records/{rid}")
        print(f"  Stu {rid}: {'✓' if res.get('code')==0 else '✗'}")
else:
    print("  (use --clean to delete dirty records)")

print("\n✓ T15 done")
