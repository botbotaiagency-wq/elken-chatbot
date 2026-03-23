---
status: partial
phase: 07-integration-and-launch
source: [07-VERIFICATION.md]
started: 2026-03-23T00:00:00Z
updated: 2026-03-23T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Seed against live DB
expected: run `node scripts/seed-elken.mjs` — 36 FAQ rows appear in Supabase, all 6 response templates present in EN/BM/ZH
result: [pending]

### 2. Smoke test against Vercel
expected: run `bash scripts/smoke-test.sh` against deployed URL — 9/9 PASS
result: [pending]

### 3. WhatsApp end-to-end flow
expected: send a Chinese booking message via WhatsApp with n8n active — Chinese-language response with location options returned
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
