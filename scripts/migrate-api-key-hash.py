#!/usr/bin/env python3
"""T08: Migrate existing plaintext API keys to hashed format.
Reads Students table, hashes each api_key → writes api_key_hash field.
Idempotent: skips records that already have api_key_hash.

Run: cd ~/elite20-merge/merged && python3 scripts/migrate-api-key-hash.py
"""
import json, urllib.request, os, hashlib

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

def list_all(table_id):
    items = []
    page_token = None
    while True:
        path = f"/bitable/v1/apps/{app_token}/tables/{table_id}/records?page_size=500"
        if page_token:
            path += f"&page_token={page_token}"
        res = api("GET", path)
        data = res.get("data", {})
        items.extend(data.get("items", []))
        if not data.get("has_more"):
            break
        page_token = data.get("page_token")
    return items

def update(record_id, fields):
    api("PUT", f"/bitable/v1/apps/{app_token}/tables/{stu_table}/records/{record_id}",
        {"fields": fields})

def get_text(fields, *names):
    for n in names:
        v = fields.get(n)
        if v:
            if isinstance(v, list):
                v = v[0].get("text", "") if v else ""
            return str(v)
    return ""

print("=== T08: API Key Hash Migration ===\n")

records = list_all(stu_table)
hashed = 0
skipped = 0
no_key = 0

for rec in records:
    rid = rec["record_id"]
    fields = rec.get("fields", {})
    api_key = get_text(fields, "API Key", "api_key")
    existing_hash = get_text(fields, "API Key Hash", "api_key_hash")

    if existing_hash:
        skipped += 1
        continue

    if not api_key:
        no_key += 1
        continue

    h = hashlib.sha256(api_key.encode()).hexdigest()
    update(rid, {"API Key Hash": h})
    hashed += 1
    if hashed % 10 == 0:
        print(f"  Progress: {hashed} hashed...")

print(f"\nDone! Hashed: {hashed}, Already hashed: {skipped}, No key: {no_key}")
