---
phase: 3
slug: webhook-gateway
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm run test -- tests/api/keys.test.ts tests/api/chat-auth.test.ts` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- tests/api/keys.test.ts tests/api/chat-auth.test.ts`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 3-01-01 | 01 | 0 | API-01 | unit | `npm run test -- tests/api/keys.test.ts` | ❌ W0 | ⬜ pending |
| 3-01-02 | 01 | 1 | API-01 | unit | `npm run test -- tests/api/keys.test.ts` | ❌ W0 | ⬜ pending |
| 3-01-03 | 01 | 1 | API-02 | unit | `npm run test -- tests/api/keys.test.ts` | ❌ W0 | ⬜ pending |
| 3-02-01 | 02 | 1 | API-03 | integration | `npm run test -- tests/api/chat-auth.test.ts` | ✅ | ⬜ pending |
| 3-02-02 | 02 | 1 | API-03 | integration | `npm run test -- tests/api/chat-auth.test.ts` | ✅ | ⬜ pending |
| 3-03-01 | 03 | 2 | API-04 | manual | N/A | N/A | ⬜ pending |
| 3-03-02 | 03 | 2 | API-05 | manual | N/A | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/api/keys.test.ts` — stubs for API-01, API-02 (key generation, listing, revocation)
- [ ] Update `tests/api/chat-auth.test.ts` — add cases for `api_keys` table path (API-03)

*Existing vitest infrastructure covers framework requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Integrations page displays copy-paste webhook URL | API-04 | UI rendering requires browser | Visit `/dashboard/bots/[botId]/integrations`, verify webhook URL and n8n snippet are displayed |
| n8n JSON body snippet shown for Telegram and WhatsApp | API-05 | UI rendering requires browser | Verify both platform snippets render with correct format |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
