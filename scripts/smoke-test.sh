#!/usr/bin/env bash
# Elken smoke test — 9 curl calls (3 intents x 3 languages)
# Usage: bash scripts/smoke-test.sh
#
# Required env vars in .env.local (or export directly):
#   SMOKE_TEST_URL — base URL of deployed app (e.g. https://your-app.vercel.app)
#                    Falls back to VERCEL_URL if SMOKE_TEST_URL not set
#   X_API_KEY      — valid API key for the Elken bot
set -euo pipefail

# ── Parse .env.local ─────────────────────────────────────────────────────────
ENV_FILE="$(dirname "$0")/../.env.local"
if [ -f "$ENV_FILE" ]; then
  SMOKE_TEST_URL="${SMOKE_TEST_URL:-$(grep '^SMOKE_TEST_URL=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '"' || true)}"
  SMOKE_TEST_URL="${SMOKE_TEST_URL:-$(grep '^VERCEL_URL=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '"' || true)}"
  X_API_KEY="${X_API_KEY:-$(grep '^X_API_KEY=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '"' || true)}"
fi

if [ -z "${SMOKE_TEST_URL:-}" ]; then
  echo "ERROR: SMOKE_TEST_URL (or VERCEL_URL) not set in .env.local or environment"
  exit 1
fi
if [ -z "${X_API_KEY:-}" ]; then
  echo "ERROR: X_API_KEY not set in .env.local or environment"
  exit 1
fi

# Strip trailing slash
SMOKE_TEST_URL="${SMOKE_TEST_URL%/}"

BOT_ID="6176aa27-ce33-4dbc-b478-407414f86cac"
PASS=0
FAIL=0

call_chat() {
  local label="$1" message="$2" lang="$3"
  printf "  %-40s ... " "$label ($lang)"
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 \
    -X POST "${SMOKE_TEST_URL}/api/chat/${BOT_ID}" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: ${X_API_KEY}" \
    -d "{\"message\": \"${message}\", \"userId\": \"smoke-test-${lang}\", \"channel\": \"whatsapp\", \"conversationId\": \"smoke-${lang}-$(date +%s)\"}")
  if [ "$HTTP_STATUS" = "200" ]; then
    echo "PASS ($HTTP_STATUS)"
    PASS=$((PASS + 1))
  else
    echo "FAIL ($HTTP_STATUS)"
    FAIL=$((FAIL + 1))
  fi
}

echo ""
echo "Elken Smoke Test"
echo "================"
echo "URL: ${SMOKE_TEST_URL}"
echo "Bot: ${BOT_ID}"
echo ""

echo "Product Enquiries:"
call_chat "product_enquiry" "Tell me about Elken skincare products" "en"
call_chat "product_enquiry" "Ceritakan tentang produk penjagaan kulit Elken" "bm"
call_chat "product_enquiry" "介绍一下Elken护肤产品" "zh"

echo ""
echo "Health Concerns:"
call_chat "health_concern" "I have back pain, what products help?" "en"
call_chat "health_concern" "Saya ada sakit belakang, produk apa yang membantu?" "bm"
call_chat "health_concern" "我有背痛，有什么产品可以帮助？" "zh"

echo ""
echo "Booking Intent:"
call_chat "booking_intent" "I want to book a GenQi session" "en"
call_chat "booking_intent" "Saya ingin menempah sesi GenQi" "bm"
call_chat "booking_intent" "我想预约GenQi疗程" "zh"

echo ""
echo "────────────────────────────────────"
echo "Results: ${PASS} passed, ${FAIL} failed (of 9)"
if [ "$FAIL" -gt 0 ]; then
  echo "SMOKE TEST FAILED"
  exit 1
else
  echo "ALL TESTS PASSED"
fi
