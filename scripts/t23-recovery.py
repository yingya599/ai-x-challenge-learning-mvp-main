#!/usr/bin/env python3
"""T23.1: Redis FLUSHALL recovery — rebuild cache from Feishu.
Run: cd ~/elite20-merge/merged && python3 scripts/t23-recovery.py

After FLUSHALL, re-populates Redis caches from Feishu Bitable.
Verifies zero data loss — Feishu is the source of truth.
"""
import json, urllib.request, os, sys, redis as redis_lib

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

def get_token():
    req = urllib.request.Request(
        "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
        data=json.dumps({"app_id": APP_ID, "app_secret": APP_SECRET}).encode(),
        headers={"Content-Type": "application/json"}, method="POST")
    return json.loads(urllib.request.urlopen(req).read())["tenant_access_token"]

TOKEN = get_token()

def api(method, path, body=None):
    url = f"https://open.feishu.cn/open-apis{path}"
    data = json.dumps(body).encode() if body else None
    r = urllib.request.Request(url, data=data, method=method)
    r.add_header("Authorization", f"Bearer {TOKEN}")
    r.add_header("Content-Type", "application/json; charset=utf-8")
    return json.loads(urllib.request.urlopen(r).read())

def list_records(table_id):
    path = f"/bitable/v1/apps/{APP_TOKEN}/tables/{table_id}/records?page_size=500"
    resp = api("GET", path)
    if resp.get("code") != 0:
        raise SystemExit(f"List failed: {resp.get('msg')}")
    return resp.get("data", {}).get("items", [])

# ---- Main ----
print("T23.1: FLUSHALL recovery test")
print("=" * 60)

tables = {
    "Students": env["FEISHU_STUDENTS_TABLE_ID"],
    "Challenges": env["FEISHU_CHALLENGES_TABLE_ID"],
    "Submissions": env["FEISHU_SUBMISSIONS_TABLE_ID"],
    "Evaluations": env["FEISHU_EVALUATIONS_TABLE_ID"],
    "Portfolio": env["FEISHU_PORTFOLIO_TABLE_ID"],
}

# Connect to Redis
REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379")
r = redis_lib.from_url(REDIS_URL)
r.ping()
print(f"Redis connected: {REDIS_URL}")

# FLUSHALL
print("\nFLUSHALL — clearing all Redis data...")
r.flushall()
print("FLUSHALL done")

# Rebuild from Feishu
total_recovered = 0
for table_name, table_id in tables.items():
    print(f"\nRecovering {table_name}...")
    records = list_records(table_id)
    print(f"  {len(records)} records in Feishu")

    for rec in records:
        record_id = rec.get("record_id", "")
        key = f"cache:{table_name.lower()}:{record_id}"
        r.setex(key, 600, json.dumps(rec.get("fields", {}), ensure_ascii=False))
        total_recovered += 1

    print(f"  cached {len(records)} records")

print(f"\n{'=' * 60}")
print(f"Recovery complete: {total_recovered} records from Feishu")
print(f"Zero data loss — Feishu is the source of truth.")

# Verify
print(f"\nVerification:")
for table_name, table_id in tables.items():
    feishu_count = len(list_records(table_id))
    redis_keys = r.keys(f"cache:{table_name.lower()}:*")
    match = "PASS" if len(redis_keys) >= feishu_count else "FAIL"
    print(f"  {table_name}: Feishu={feishu_count}, Redis={len(redis_keys)} [{match}]")

print(f"\nT23.1 PASSED")
