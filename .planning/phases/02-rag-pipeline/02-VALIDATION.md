---
phase: 2
slug: rag-pipeline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose --coverage` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose --coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 0 | KB-01 | migration | `npx supabase db diff` | ❌ W0 | ⬜ pending |
| 2-01-02 | 01 | 1 | KB-02 | unit | `npx vitest run tests/lib/chunker.test.ts` | ❌ W0 | ⬜ pending |
| 2-01-03 | 01 | 1 | KB-03 | unit | `npx vitest run tests/lib/embedder.test.ts` | ❌ W0 | ⬜ pending |
| 2-01-04 | 01 | 1 | KB-04 | integration | `npx vitest run tests/api/documents.test.ts` | ❌ W0 | ⬜ pending |
| 2-01-05 | 01 | 1 | KB-05 | integration | `npx vitest run tests/api/documents.test.ts` | ❌ W0 | ⬜ pending |
| 2-02-01 | 02 | 2 | RAG-01 | unit | `npx vitest run tests/lib/retriever.test.ts` | ❌ W0 | ⬜ pending |
| 2-02-02 | 02 | 2 | RAG-02 | unit | `npx vitest run tests/lib/retriever.test.ts` | ❌ W0 | ⬜ pending |
| 2-02-03 | 02 | 2 | RAG-03 | unit | `npx vitest run tests/lib/retriever.test.ts` | ❌ W0 | ⬜ pending |
| 2-02-04 | 02 | 2 | RAG-04 | unit | `npx vitest run tests/lib/faq-matcher.test.ts` | ❌ W0 | ⬜ pending |
| 2-03-01 | 03 | 3 | RAG-05 | integration | `npx vitest run tests/api/chat.test.ts` | ❌ W0 | ⬜ pending |
| 2-03-02 | 03 | 3 | RAG-06 | unit | `npx vitest run tests/lib/logger.test.ts` | ❌ W0 | ⬜ pending |
| 2-03-03 | 03 | 3 | RAG-07 | manual | — | — | ⬜ pending |
| 2-03-04 | 03 | 3 | RAG-08 | manual | — | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/lib/chunker.test.ts` — stubs for KB-02 (token-based chunking)
- [ ] `tests/lib/embedder.test.ts` — stubs for KB-03 (Voyage AI embedding)
- [ ] `tests/api/documents.test.ts` — stubs for KB-04, KB-05 (upload/delete endpoints)
- [ ] `tests/lib/retriever.test.ts` — stubs for RAG-01, RAG-02, RAG-03 (pgvector similarity search)
- [ ] `tests/lib/faq-matcher.test.ts` — stubs for RAG-04 (FAQ priority matching)
- [ ] `tests/api/chat.test.ts` — stubs for RAG-05 (chat endpoint RAG integration)
- [ ] `tests/lib/logger.test.ts` — stubs for RAG-06 (message logging)
- [ ] `tests/setup.ts` — shared vitest fixtures (Supabase mock client, test tenant)
- [ ] vitest install if missing: `npm install -D vitest @vitest/coverage-v8`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Query in Bahasa Malaysia returns top-k chunks | RAG-07 | Requires real multilingual embeddings | Upload BM doc, send BM query via WhatsApp simulator, check similarity score ≥ 0.75 |
| Query in Chinese returns top-k chunks | RAG-08 | Requires real multilingual embeddings | Upload Chinese doc, send Chinese query via WhatsApp simulator, check similarity score ≥ 0.75 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
