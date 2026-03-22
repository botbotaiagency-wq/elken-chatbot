---
phase: 6
slug: analytics
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-22
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.x |
| **Config file** | `vitest.config.ts` (exists at project root) |
| **Quick run command** | `npx vitest run tests/api/analytics.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/api/analytics.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-W0-01 | W0 | 0 | ANAL-01–11 | unit stub | `npx vitest run tests/api/analytics.test.ts` | ❌ W0 | ⬜ pending |
| 06-W0-02 | W0 | 0 | ANAL-12 | unit stub | `npx vitest run tests/lib/csv.test.ts` | ❌ W0 | ⬜ pending |
| 06-W0-03 | W0 | 0 | ANAL-01–02 | install | `ls components/ui/chart.tsx` | ❌ W0 | ⬜ pending |
| 06-W0-04 | W0 | 0 | ANAL-01–11 | migration | `ls supabase/migrations/00011_analytics.sql` | ❌ W0 | ⬜ pending |
| 06-01 | 01 | 1 | ANAL-01 | unit | `npx vitest run tests/api/analytics.test.ts` | ❌ W0 | ⬜ pending |
| 06-02 | 01 | 1 | ANAL-02 | unit | `npx vitest run tests/api/analytics.test.ts` | ❌ W0 | ⬜ pending |
| 06-03 | 01 | 1 | ANAL-03 | unit | `npx vitest run tests/api/analytics.test.ts` | ❌ W0 | ⬜ pending |
| 06-04 | 01 | 1 | ANAL-04 | unit | `npx vitest run tests/api/analytics.test.ts` | ❌ W0 | ⬜ pending |
| 06-05 | 02 | 1 | ANAL-05 | unit | `npx vitest run tests/api/analytics.test.ts` | ❌ W0 | ⬜ pending |
| 06-06 | 02 | 1 | ANAL-06 | unit | `npx vitest run tests/api/analytics.test.ts` | ❌ W0 | ⬜ pending |
| 06-07 | 02 | 1 | ANAL-07 | unit | `npx vitest run tests/api/analytics.test.ts` | ❌ W0 | ⬜ pending |
| 06-08 | 02 | 1 | ANAL-08 | unit | `npx vitest run tests/api/analytics.test.ts` | ❌ W0 | ⬜ pending |
| 06-09 | 02 | 2 | ANAL-09 | unit | `npx vitest run tests/api/analytics.test.ts` | ❌ W0 | ⬜ pending |
| 06-10 | 02 | 2 | ANAL-10 | unit | `npx vitest run tests/api/analytics.test.ts` | ❌ W0 | ⬜ pending |
| 06-11 | 02 | 2 | ANAL-11 | unit | `npx vitest run tests/api/analytics.test.ts` | ❌ W0 | ⬜ pending |
| 06-12 | 03 | 2 | ANAL-12 | unit | `npx vitest run tests/lib/csv.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/api/analytics.test.ts` — API route handler stubs for ANAL-01 through ANAL-11 (Plan 06-00 Task 1)
- [ ] `tests/lib/csv.test.ts` — unit test stubs for `downloadCsv` utility, ANAL-12 (Plan 06-00 Task 2)
- [ ] `components/ui/chart.tsx` — install via `npx shadcn@latest add chart` (Plan 06-01 Task 1)
- [ ] `supabase/migrations/00011_analytics.sql` — SQL RPCs: `get_latency_stats`, `get_message_volume`, `get_intent_breakdown`, `get_booking_funnel` (Plan 06-01 Task 1)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Date filter persists across tab switches | ANAL-01–12 | UI state behavior, not testable in unit tests | Switch tabs while date filter is active — verify filter value unchanged |
| CSV file downloads in browser | ANAL-12 | Requires browser DOM (anchor click, Blob URL) | Click Export CSV — verify file downloads with correct headers and data |
| Chart renders area/bar shapes correctly | ANAL-01, ANAL-02 | Visual rendering not unit-testable | Load analytics page — verify area chart and horizontal bar chart render with data |
| Booking funnel stat row layout | ANAL-11 | Visual layout | Confirm 4 boxes display: Enquiries → Submitted → Confirmed → Attended with counts and percentages |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
