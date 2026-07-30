#!/bin/bash
# NSEAP 集成测试 — 核心提交流程验证
# Usage: bash scripts/integration-test.sh

set -e
BASE="http://localhost:3000"
PASS=0
FAIL=0
COOKIE=/tmp/nseap_test_cookies.txt

ok()  { echo "  ✅ $1"; PASS=$((PASS+1)); }
fail(){ echo "  ❌ $1"; FAIL=$((FAIL+1)); }
check(){ if [ "$1" = "$2" ]; then ok "$3"; else fail "$3 (expected $2, got $1)"; fi; }

echo "=== NSEAP Integration Test ==="
echo ""

# 1. Health
echo "[1] Health Check"
STATUS=$(curl -s "$BASE/api/health" | python3 -c "import sys,json;print(json.load(sys.stdin)['ok'])" 2>/dev/null)
check "$STATUS" "True" "/api/health"

# 2. Login
echo "[2] Login"
LOGIN=$(curl -s -c "$COOKIE" -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"studentId":"2023108600138","name":"张浩"}')
LOGIN_OK=$(echo "$LOGIN" | python3 -c "import sys,json;print(json.load(sys.stdin)['ok'])" 2>/dev/null)
ROLE=$(echo "$LOGIN" | python3 -c "import sys,json;print(json.load(sys.stdin).get('role',''))" 2>/dev/null)
check "$LOGIN_OK" "True" "Login ok"
check "$ROLE" "student" "Role=student"

# 3. Challenges list
echo "[3] Challenges"
CHALLENGES=$(curl -s -b "$COOKIE" "$BASE/api/challenges")
CH_OK=$(echo "$CHALLENGES" | python3 -c "import sys,json;print(json.load(sys.stdin)['ok'])" 2>/dev/null)
CH_COUNT=$(echo "$CHALLENGES" | python3 -c "import sys,json;print(len(json.load(sys.stdin).get('challenges',[])))" 2>/dev/null)
check "$CH_OK" "True" "Challenges list ok"
if [ "$CH_COUNT" -gt 0 ] 2>/dev/null; then ok "Challenges count=$CH_COUNT"; else fail "No challenges found"; fi

# 4. Submit
echo "[4] Submit"
SUBMIT=$(curl -s --max-time 20 -b "$COOKIE" -X POST "$BASE/api/submit" \
  -H "Content-Type: application/json" \
  -d '{"challengeId":"ch-20260715024955-1muvzd","projectTitle":"集成测试项目","githubRepoUrl":"https://github.com/a976xw7td/nseap-elite20-challenges","projectSummary":"自动化测试","isPublic":true,"aarText":"测试","selfEvaluationText":"测试"}')
SUB_OK=$(echo "$SUBMIT" | python3 -c "import sys,json;print(json.load(sys.stdin)['ok'])" 2>/dev/null)
TASK_ID=$(echo "$SUBMIT" | python3 -c "import sys,json;print(json.load(sys.stdin).get('task_id',''))" 2>/dev/null)
check "$SUB_OK" "True" "Submit ok"
if [ -n "$TASK_ID" ]; then ok "Task created: $TASK_ID"; fi

# 5. Wait & check evaluation
echo "[5] Evaluation (waiting 20s for AI)"
sleep 20
SUBS=$(curl -s -b "$COOKIE" "$BASE/api/submissions")
SUB_ID=$(echo "$SUBS" | python3 -c "
import sys,json
for s in json.load(sys.stdin).get('submissions',[]):
    if '集成测试项目' in s.get('project_title',''):
        print(s['submission_id']); break
" 2>/dev/null)
if [ -n "$SUB_ID" ]; then
  ok "Submission found: $SUB_ID"
  DETAIL=$(curl -s -b "$COOKIE" "$BASE/api/submissions/$SUB_ID")
  EVAL_SCORE=$(echo "$DETAIL" | python3 -c "import sys,json;e=json.load(sys.stdin).get('evaluation');print(e['score_total'] if e else 'None')" 2>/dev/null)
  if [ "$EVAL_SCORE" != "None" ] && [ -n "$EVAL_SCORE" ]; then
    ok "AI Score: $EVAL_SCORE"
  else
    fail "No AI evaluation found (may still be processing)"
  fi
  EVAL_FB=$(echo "$DETAIL" | python3 -c "import sys,json;e=json.load(sys.stdin).get('evaluation');print('YES' if e and e.get('feedback') else 'NO')" 2>/dev/null)
  check "$EVAL_FB" "YES" "Evaluation has feedback"
else
  fail "Submission not found in list"
fi

# 6. Profile
echo "[6] Profile"
ME=$(curl -s -b "$COOKIE" "$BASE/api/auth/me")
ME_OK=$(echo "$ME" | python3 -c "import sys,json;print(json.load(sys.stdin)['ok'])" 2>/dev/null)
check "$ME_OK" "True" "Auth/me ok"

# 7. Portfolio
echo "[7] Portfolio"
PF=$(curl -s -b "$COOKIE" "$BASE/api/portfolio")
PF_OK=$(echo "$PF" | python3 -c "import sys,json;print(json.load(sys.stdin).get('ok',False))" 2>/dev/null)
check "$PF_OK" "True" "Portfolio ok"

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
[ "$FAIL" -eq 0 ] && echo "🎉 ALL PASSED" || echo "⚠️  SOME FAILED"
