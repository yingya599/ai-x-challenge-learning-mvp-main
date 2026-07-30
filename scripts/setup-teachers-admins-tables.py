#!/usr/bin/env python3
"""T06: Feishu Teachers/Admins table setup — idempotent script.
Run: cd ~/elite20-merge/merged && python3 scripts/setup-teachers-admins-tables.py

Creates Teachers and Admins tables, appends table IDs to .env.local.
Second run is a no-op (all "already exists").
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
app_secret = env["FEISHU_APP_SECRET"]
app_token = env["FEISHU_APP_TOKEN"]

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

def list_tables():
    return api("GET", f"/bitable/v1/apps/{app_token}/tables").get("data", {}).get("items", [])

def table_exists(name):
    tables = list_tables()
    return any(t.get("name") == name for t in tables)

def ensure_table(name, fields, env_key):
    if table_exists(name):
        print(f"  ✓ Table '{name}' already exists")
        return

    print(f"  Creating table '{name}'...")
    res = api("POST", f"/bitable/v1/apps/{app_token}/tables", {
        "table": {"name": name}
    })
    if res.get("code") != 0:
        print(f"  ✗ Failed to create table: {res.get('msg')}")
        sys.exit(1)

    table_id = res["data"]["table_id"]
    print(f"  ✓ Table created: {table_id}")

    # Add fields
    for fname, ftype in fields:
        sys.stdout.write(f"    Adding field '{fname}' (type={ftype})... ")
        sys.stdout.flush()
        r = api("POST", f"/bitable/v1/apps/{app_token}/tables/{table_id}/fields", {
            "field_name": fname, "type": ftype
        })
        if r.get("code") == 0:
            print("✓")
        else:
            print(f"✗ {r.get('msg')}")

    # Append table ID to .env.local
    env_file = os.path.join(os.path.dirname(__file__), "..", ".env.local")
    with open(env_file, "a") as f:
        f.write(f"\n{env_key}={table_id}\n")
    print(f"  ✓ {env_key}={table_id} appended to .env.local")

    return table_id

print("=== T06: Teachers & Admins Table Setup ===\n")

# Teachers table
TEACHER_FIELDS = [
    ("teacher_id", 1),
    ("姓名", 1),
    ("email", 1),
    ("角色", 3),  # single select
    ("API Key Hash", 1),
    ("班级ID", 1),
    ("状态", 1),
]
ensure_table("Teachers", TEACHER_FIELDS, "FEISHU_TEACHERS_TABLE_ID")

# Admins table
ADMIN_FIELDS = [
    ("admin_id", 1),
    ("姓名", 1),
    ("email", 1),
    ("角色", 3),
    ("API Key Hash", 1),
    ("状态", 1),
]
ensure_table("Admins", ADMIN_FIELDS, "FEISHU_ADMINS_TABLE_ID")

print("\nDone! Tables are ready.")
