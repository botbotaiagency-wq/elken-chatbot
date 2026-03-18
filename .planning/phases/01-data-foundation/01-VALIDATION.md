---
phase: 1
slug: data-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pgTAP (via `supabase test db`) + vitest (Next.js) |
| **Config file** | `supabase/tests/` directory |
| **Quick run command** | `supabase test db` |
| **Full suite command** | `supabase test db && npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `supabase test db`
- **After every plan wave:** Run `supabase test db && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | AUTH-01 | pgTAP | `supabase test db` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 1 | AUTH-02 | pgTAP | `supabase test db` | ❌ W0 | ⬜ pending |
| 1-01-03 | 01 | 1 | AUTH-03 | pgTAP | `supabase test db` | ❌ W0 | ⬜ pending |
| 1-01-04 | 01 | 1 | AUTH-04 | pgTAP | `supabase test db` | ❌ W0 | ⬜ pending |
| 1-01-05 | 01 | 1 | AUTH-05 | pgTAP | `supabase test db` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `supabase/tests/01_tenant_isolation.sql` — pgTAP tests for two-tenant isolation (AUTH-03)
- [ ] `supabase/tests/02_rls_policies.sql` — pgTAP tests for RLS bot-scoping (AUTH-04)
- [ ] `supabase/tests/00_helpers.sql` — JWT simulation helpers using `SET LOCAL request.jwt.claims`

*pgTAP extension must be enabled via `create extension if not exists pgtap` in a migration.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Custom Access Token Hook enabled | AUTH-02 | Supabase Dashboard UI only — no CLI/config.toml support | Dashboard → Authentication → Hooks → Enable custom_access_token_hook |
| Super-admin sees all tenants in dashboard | AUTH-02 | Requires browser login session | Log in as Navien, verify tenant list page shows all tenants |
| New tenant onboarding (no code changes) | AUTH-05 | Requires INSERT + manual verification | Insert tenant+bot record, verify auth scoping works without deployment |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
