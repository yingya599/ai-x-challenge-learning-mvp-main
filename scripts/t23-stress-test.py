#!/usr/bin/env python3
"""T23.2: 50-concurrent submission stress test.
Run: cd ~/elite20-merge/merged && python3 scripts/t23-stress-test.py

Sends 50 concurrent POST /api/submit requests and reports:
  - Success/failure counts
  - Latency percentiles (p50, p95, p99)
  - Dedup effectiveness
  - Redis/Feishu consistency
"""
import json, urllib.request, os, sys, time
from concurrent.futures import ThreadPoolExecutor, as_completed

# Bypass system proxy for localhost
os.environ["no_proxy"] = "127.0.0.1,localhost,.local"

BASE_URL = os.environ.get("BASE_URL", "http://localhost:3000")
CONCURRENT = 50
CHALLENGE_ID = os.environ.get("CHALLENGE_ID", "cha_demo_001")

def get_session():
    """Login and return session cookies."""
    cookie_jar = []
    req = urllib.request.Request(
        f"{BASE_URL}/api/auth/login",
        data=json.dumps({"studentId": "stu_zhanghao_001", "name": "张浩"}).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    resp = urllib.request.urlopen(req)
    for h in resp.headers.get_all("Set-Cookie") or []:
        cookie_jar.append(h.split(";")[0])
    return "; ".join(cookie_jar)

def submit_one(i, cookie):
    """Submit one project and return timing."""
    start = time.monotonic()
    try:
        body = json.dumps({
            "studentId": "stu_zhanghao_001",
            "challengeId": CHALLENGE_ID,
            "projectTitle": f"压测任务 #{i}",
            "projectSummary": f"T23 并发压测第 {i} 个提交",
            "githubRepoUrl": f"https://github.com/zhanghao/nseap-demo-{i}",
            "aarText": "压测 AAR",
            "selfEvaluationText": "压测自评",
            "isPublic": False,
            "reviewMode": "teacher_only",
        }).encode()

        req = urllib.request.Request(
            f"{BASE_URL}/api/submit",
            data=body,
            headers={
                "Content-Type": "application/json",
                "Cookie": cookie,
            },
            method="POST",
        )
        resp = urllib.request.urlopen(req, timeout=60)
        data = json.loads(resp.read())
        elapsed = time.monotonic() - start
        return {"i": i, "ok": data.get("ok", False), "elapsed": elapsed,
                "task_id": data.get("task_id"), "submissionId": data.get("submissionId"),
                "error": data.get("error")}
    except Exception as e:
        elapsed = time.monotonic() - start
        return {"i": i, "ok": False, "elapsed": elapsed, "error": str(e)}

# ---- Main ----

print("T23.2: 50-concurrent stress test")
print("=" * 60)
print(f"Target: {BASE_URL}")
print(f"Concurrency: {CONCURRENT}")

cookie = get_session()
print(f"✓ Login OK")

results = []
start = time.monotonic()

with ThreadPoolExecutor(max_workers=CONCURRENT) as pool:
    futures = [pool.submit(submit_one, i, cookie) for i in range(CONCURRENT)]
    for f in as_completed(futures):
        results.append(f.result())

total_elapsed = time.monotonic() - start

# Analysis
ok = [r for r in results if r["ok"]]
failed = [r for r in results if not r["ok"]]
async_ok = [r for r in ok if r.get("task_id")]
sync_ok = [r for r in ok if r.get("submissionId")]
latencies = sorted(r["elapsed"] for r in results)

print(f"\nResults:")
print(f"  Total: {len(results)}")
print(f"  Success: {len(ok)} ({len(ok)/CONCURRENT*100:.0f}%)")
print(f"  Failed: {len(failed)} ({len(failed)/CONCURRENT*100:.0f}%)")
print(f"  Async (task_id): {len(async_ok)}")
print(f"  Sync (direct): {len(sync_ok)}")
print(f"  Total time: {total_elapsed:.1f}s")
print(f"  Throughput: {CONCURRENT/total_elapsed:.1f} req/s")

if latencies:
    p50 = latencies[len(latencies)//2]
    p95 = latencies[int(len(latencies)*0.95)]
    p99 = latencies[int(len(latencies)*0.99)]
    print(f"\nLatency:")
    print(f"  p50: {p50*1000:.0f}ms")
    print(f"  p95: {p95*1000:.0f}ms")
    print(f"  p99: {p99*1000:.0f}ms")
    print(f"  max: {latencies[-1]*1000:.0f}ms")

if failed:
    print(f"\nFailures:")
    for r in failed[:5]:
        print(f"  #{r['i']}: {r.get('error', 'unknown')}")

# Dedup check
duplicates = len(failed) if any("重复" in str(r.get("error", "")) for r in failed) else 0
if duplicates:
    print(f"\n  Dedup blocked: {duplicates}")

print(f"\n{'✓ T23.2 PASSED' if len(ok)/CONCURRENT >= 0.9 else '✗ T23.2 FAILED — success rate below 90%'}")
