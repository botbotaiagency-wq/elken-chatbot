---
phase: 7
slug: integration-and-launch
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-23
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (configured in vitest.config.ts) |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run tests/` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run` — verify no regressions in existing suite
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** All 3 deliverables (seed, smoke test, n8n guide) verified manually
- **Max feedback latency:** ~10 seconds (automated regression check only)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 7-01-01 | 01 | 1 | SEED-01, SEED-04 | manual | `node scripts/seed-elken.mjs` then `SELECT name, greeting_en, tone, feature_flags FROM bots WHERE id = '...'` | ✅ | ⬜ pending |
| 7-01-02 | 01 | 1 | SEED-02 | manual | `SELECT count(*) FROM faqs WHERE bot_id = '...'` after seed | ✅ | ⬜ pending |
| 7-01-03 | 01 | 1 | SEED-03 | manual | `SELECT intent_key, language FROM response_templates WHERE bot_id = '...'` — expect 6 intent_keys × 3 languages | ✅ | ⬜ pending |
| 7-02-01 | 02 | 2 | SEED-01 | manual | Run `bash scripts/smoke-test.sh` — all 9 curl calls return HTTP 200 | ❌ W0 | ⬜ pending |
| 7-03-01 | 03 | 2 | SEED-01 | manual | `docs/n8n-setup.md` exists and covers all required n8n config steps | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/smoke-test.sh` — created by plan 02 (bash script with 9 curl calls)
- [ ] `docs/n8n-setup.md` — created by plan 03 (operator setup guide)

*These are deliverables created during execution, not pre-existing test infrastructure.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Seed creates Elken tenant + bot with correct name "Ask Ethan Digital" | SEED-01 | Operational script; writes to Supabase | Run `node scripts/seed-elken.mjs`, query `SELECT name FROM bots WHERE name = 'Ask Ethan Digital'` |
| FAQs seeded in EN/BM/ZH for all GenQi locations | SEED-02 | DB content validation | `SELECT language, count(*) FROM faqs WHERE bot_id = '...' GROUP BY language` — expect counts in en/bm/zh |
| All 6 response templates exist in 3 languages (18 rows) | SEED-03 | DB content validation | `SELECT intent_key, language FROM response_templates WHERE bot_id = '...' ORDER BY intent_key, language` |
| Bot personality config written (greeting_en/bm/zh, tone=Friendly, booking_enabled=true) | SEED-04 | DB content validation | `SELECT greeting_en, greeting_bm, greeting_zh, tone, feature_flags FROM bots WHERE id = '...'` |
| Smoke test returns HTTP 200 for all 9 curl calls | SEED-01 | Live Vercel endpoint required | Run `bash scripts/smoke-test.sh` against deployed URL |
| Real WhatsApp message flows through n8n to RAG pipeline | SEED-01 | Requires live n8n + WhatsApp | Follow `docs/n8n-setup.md` manual checklist steps |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s (regression suite)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
