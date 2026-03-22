---
phase: 5
slug: booking-system
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-22
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing — `vitest.config.ts` present) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run --reporter=verbose 2>&1 | tail -20` |
| **Full suite command** | `npx vitest run 2>&1` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose 2>&1 | tail -20`
- **After every plan wave:** Run `npx vitest run 2>&1`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | BOOK-01 | unit | `npx vitest run tests/booking/schema.test.ts` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | BOOK-02 | unit | `npx vitest run tests/booking/rpc.test.ts` | ❌ W0 | ⬜ pending |
| 05-01-03 | 01 | 1 | BOOK-03 | unit | `npx vitest run tests/booking/rpc.test.ts` | ❌ W0 | ⬜ pending |
| 05-02-01 | 02 | 1 | BOOK-04 | unit | `npx vitest run tests/booking/state-machine.test.ts` | ❌ W0 | ⬜ pending |
| 05-02-02 | 02 | 1 | BOOK-05 | unit | `npx vitest run tests/booking/state-machine.test.ts` | ❌ W0 | ⬜ pending |
| 05-02-03 | 02 | 1 | BOOK-06 | unit | `npx vitest run tests/booking/state-machine.test.ts` | ❌ W0 | ⬜ pending |
| 05-03-01 | 03 | 2 | BOOK-07 | unit | `npx vitest run tests/booking/chat-handler.test.ts` | ❌ W0 | ⬜ pending |
| 05-03-02 | 03 | 2 | BOOK-08 | unit | `npx vitest run tests/booking/chat-handler.test.ts` | ❌ W0 | ⬜ pending |
| 05-03-03 | 03 | 2 | BOOK-09 | unit | `npx vitest run tests/booking/chat-handler.test.ts` | ❌ W0 | ⬜ pending |
| 05-03-04 | 03 | 2 | BOOK-10 | unit | `npx vitest run tests/booking/capacity.test.ts` | ❌ W0 | ⬜ pending |
| 05-04-01 | 04 | 2 | BADM-01 | unit | `npx vitest run tests/booking/admin-api.test.ts` | ❌ W0 | ⬜ pending |
| 05-04-02 | 04 | 2 | BADM-02 | unit | `npx vitest run tests/booking/admin-api.test.ts` | ❌ W0 | ⬜ pending |
| 05-04-03 | 04 | 2 | BADM-03 | unit | `npx vitest run tests/booking/admin-api.test.ts` | ❌ W0 | ⬜ pending |
| 05-04-04 | 04 | 2 | BADM-04 | unit | `npx vitest run tests/booking/admin-api.test.ts` | ❌ W0 | ⬜ pending |
| 05-04-05 | 04 | 2 | BADM-05 | manual | n/a — UI interaction | n/a | ⬜ pending |
| 05-05-01 | 05 | 3 | NOTIF-01 | unit | `npx vitest run tests/booking/notifications.test.ts` | ❌ W0 | ⬜ pending |
| 05-05-02 | 05 | 3 | NOTIF-02 | unit | `npx vitest run tests/booking/notifications.test.ts` | ❌ W0 | ⬜ pending |
| 05-05-03 | 05 | 3 | NOTIF-03 | unit | `npx vitest run tests/booking/notifications.test.ts` | ❌ W0 | ⬜ pending |
| 05-05-04 | 05 | 3 | NOTIF-04 | unit | `npx vitest run tests/booking/cron.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/booking/schema.test.ts` — stubs for BOOK-01 (bookings table, facility_slots table)
- [ ] `tests/booking/rpc.test.ts` — stubs for BOOK-02, BOOK-03 (check_and_create_booking RPC, cancel/confirm RPCs)
- [ ] `tests/booking/state-machine.test.ts` — stubs for BOOK-04, BOOK-05, BOOK-06 (booking flow state machine)
- [ ] `tests/booking/chat-handler.test.ts` — stubs for BOOK-07, BOOK-08, BOOK-09 (chat route booking integration)
- [ ] `tests/booking/capacity.test.ts` — stubs for BOOK-10 (double-booking prevention)
- [ ] `tests/booking/admin-api.test.ts` — stubs for BADM-01 through BADM-04 (admin booking routes)
- [ ] `tests/booking/notifications.test.ts` — stubs for NOTIF-01, NOTIF-02, NOTIF-03 (notification dispatch)
- [ ] `tests/booking/cron.test.ts` — stubs for NOTIF-04 (Vercel cron route authorization + scheduling)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Booking management UI renders correctly | BADM-05 | Visual layout — shadcn components, filter panel, status badges | Open `/admin/bookings` in browser, verify filter panel, status columns, walk-in registration modal |
| WhatsApp numbered-list slot selection UX | BOOK-05 | Requires live WhatsApp session | Send "book" to bot, verify numbered list of available slots is presented |
| Post-session survey delivery | BOOK-17 | Requires time-travel or manual trigger | Manually invoke survey dispatch endpoint for a completed booking, verify WhatsApp message received |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
