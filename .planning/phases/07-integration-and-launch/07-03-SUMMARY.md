---
phase: 07-integration-and-launch
plan: "03"
subsystem: seed-data
tags: [gap-closure, faq, seed, requirements]
dependency_graph:
  requires: ["07-01", "07-02"]
  provides: ["complete-trilingual-faq-seed", "accurate-seed03-requirement"]
  affects: ["scripts/seed-elken.mjs", ".planning/REQUIREMENTS.md"]
tech_stack:
  added: []
  patterns: ["idempotent-upsert", "trilingual-faq-coverage"]
key_files:
  modified:
    - scripts/seed-elken.mjs
    - .planning/REQUIREMENTS.md
decisions:
  - "BM FAQ meeting rooms: 'Siapa yang boleh menggunakan bilik mesyuarat' added after OKR BES BM entry"
  - "BM FAQ Subang BES: 'Adakah peranti BES tersedia di GenQi Subang' added after Subang facilities BM"
  - "ZH FAQ meeting rooms: 'GenQi旧巴生路的会议室谁可以使用' added after OKR BES ZH entry"
  - "ZH FAQ Subang BES: 'GenQi梳邦是否提供BES设备借用' added after Subang facilities ZH"
  - "REQUIREMENTS.md SEED-03: general_enquiry replaced with no_product_found to match implementation"
metrics:
  duration: "3min"
  completed: "2026-03-23"
  tasks_completed: 2
  files_modified: 2
---

# Phase 7 Plan 03: Gap Closure — Missing BM/ZH FAQ Translations and SEED-03 Alignment Summary

**One-liner:** Added 4 missing FAQ translations (2 BM + 2 ZH) to reach 36 total FAQ rows (12 per language), and corrected REQUIREMENTS.md SEED-03 to list `no_product_found` instead of `general_enquiry`.

## What Was Built

### Task 1: Add Missing BM and ZH FAQ Translations (commit `19af378`)

The `buildFaqs()` function in `scripts/seed-elken.mjs` was missing 2 BM and 2 ZH FAQ objects relative to the 12 EN FAQs. Added:

- **BM FAQ — OKR Meeting Room policy:** "Siapa yang boleh menggunakan bilik mesyuarat di GenQi Old Klang Road?" — inserted after the BM BES OKR entry
- **BM FAQ — Subang BES availability:** "Adakah peranti BES tersedia di GenQi Subang?" — inserted after the BM Subang facilities entry
- **ZH FAQ — OKR Meeting Room policy:** "GenQi旧巴生路的会议室谁可以使用？" — inserted after the ZH BES OKR entry
- **ZH FAQ — Subang BES availability:** "GenQi梳邦是否提供BES设备借用？" — inserted after the ZH Subang facilities entry

Result: `buildFaqs()` returns 36 FAQ objects — 12 EN, 12 BM, 12 ZH.

Note: The worktree was behind `main`. The seed file was brought up to the 07-01 completed state (from main) before adding the 4 new FAQs. This is correct — the worktree carries forward the complete work.

### Task 2: Update REQUIREMENTS.md SEED-03 (commit `a924b8f`)

REQUIREMENTS.md line 119 listed `general_enquiry` as one of the 6 seeded response template intent keys. The actual seed implementation (and 07-CONTEXT.md decision) uses `no_product_found` instead — the client did not provide a `general_enquiry` script. Updated the SEED-03 requirement text accordingly.

## Verification Results

1. `node --check scripts/seed-elken.mjs` — exits 0 (syntax valid)
2. FAQ language count: EN=12, BM=12, ZH=12 (total 36) — PASS
3. REQUIREMENTS.md SEED-03 contains "no_product_found" — PASS
4. REQUIREMENTS.md SEED-03 does NOT contain "general_enquiry" — PASS
5. All 4 new FAQ question strings present in seed-elken.mjs — PASS

## Deviations from Plan

### Auto-applied baseline update

**Found during:** Task 1 setup

**Issue:** The worktree branch (`worktree-agent-a40d2b6c`) was created from `main` before the 07-01 wave completed. The `scripts/seed-elken.mjs` in the worktree was the old partial seed (15 FAQs, old structure). REQUIREMENTS.md was also the pre-07-01 version with all SEED-* unchecked.

**Fix:** Copied both files from `main` (post-07-01 state) into the worktree before making the 07-03 changes. This is the correct approach for a gap-closure plan that builds on prior wave work.

**Impact:** No functional deviation — the gap-closure changes were applied on top of the correct baseline.

## Self-Check: PASSED

- `scripts/seed-elken.mjs` exists and syntax passes: VERIFIED
- `.planning/REQUIREMENTS.md` exists with SEED-03 correction: VERIFIED
- Task 1 commit `19af378` exists: VERIFIED
- Task 2 commit `a924b8f` exists: VERIFIED
