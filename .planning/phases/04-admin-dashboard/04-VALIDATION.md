---
phase: 4
slug: admin-dashboard
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-22
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.0 |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `npx vitest run tests/api/config.test.ts tests/api/faqs.test.ts tests/api/templates.test.ts tests/api/test-chat.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/api/{relevant-test-file}.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-00-01 | 00 | 0 | ALL | scaffold | `npx vitest run tests/api/config.test.ts tests/api/faqs.test.ts tests/api/templates.test.ts tests/api/test-chat.test.ts` | Created by W0 | pending |
| 04-01-01 | 01 | 1 | CONF-01, CONF-02, CONF-03, CONF-04, CONF-05 | unit | `npx vitest run tests/api/config.test.ts tests/api/faqs.test.ts tests/api/templates.test.ts` | W0 stubs | pending |
| 04-01-02 | 01 | 1 | CONF-01 | build | `npx next build` | N/A | pending |
| 04-02-01 | 02 | 2 | CONF-01, CONF-02, CONF-03 | unit + build | `npx next build && npx vitest run tests/api/config.test.ts` | W0 stubs | pending |
| 04-02-02 | 02 | 2 | CONF-03 | unit + build | `npx next build && npx vitest run tests/api/config.test.ts` | W0 stubs | pending |
| 04-03-01 | 03 | 2 | CONF-05 | unit + build | `npx next build && npx vitest run tests/api/faqs.test.ts` | W0 stubs | pending |
| 04-03-02 | 03 | 2 | CONF-04 | unit + build | `npx next build && npx vitest run tests/api/templates.test.ts` | W0 stubs | pending |
| 04-04-01 | 04 | 3 | TEST-01, TEST-02, TEST-03, TEST-04 | unit + build | `npx next build && npx vitest run tests/api/test-chat.test.ts` | W0 stubs | pending |
| 04-04-02 | 04 | 3 | TEST-01, TEST-02 | build | `npx next build && npx vitest run tests/api/test-chat.test.ts` | W0 stubs | pending |

*Status: pending -- ✅ green -- red -- flaky*

---

## Wave 0 Requirements

- [ ] `tests/api/config.test.ts` — stubs for CONF-01, CONF-02, CONF-03 (personality + guardrails API routes)
- [ ] `tests/api/faqs.test.ts` — stubs for CONF-05 (FAQ CRUD API)
- [ ] `tests/api/templates.test.ts` — stubs for CONF-04 (template CRUD API)
- [ ] `tests/api/test-chat.test.ts` — stubs for TEST-01, TEST-02, TEST-03, TEST-04

Vitest 4.1.0 is already installed. No new framework setup needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Streaming tokens render progressively in chat UI | TEST-01 | Visual real-time rendering cannot be unit tested | Send a message in testing console, observe tokens appearing word-by-word |
| Tab navigation highlights active route | CONF-01 | Visual CSS state | Navigate between Personality/Guardrails tabs, verify active highlight |
| Toast notifications appear on save | CONF-01, CONF-03 | Browser DOM interaction | Save personality config, verify toast appears |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify with vitest commands
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (04-00-PLAN.md creates all 4 stubs)
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
