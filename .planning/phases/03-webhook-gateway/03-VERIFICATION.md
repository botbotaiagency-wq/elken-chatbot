---
phase: 03-webhook-gateway
verified: 2026-03-21T23:20:00Z
status: human_needed
score: 9/9 must-haves verified
re_verification: false
human_verification:
  - test: "Generate API key end-to-end flow"
    expected: "Modal opens showing full ethan_live_ key, cannot be dismissed by clicking outside or pressing Escape, copy button swaps to checkmark for 2 seconds, clicking 'I've copied this key' closes modal and key appears in list with prefix badge"
    why_human: "Client-side modal behaviour, clipboard API, and icon swap timing cannot be verified programmatically"
  - test: "Inline revoke confirmation flow"
    expected: "Clicking trash icon on a key row shows confirmation text with 'Yes, revoke' and 'Keep key' buttons; 'Keep key' dismisses the confirmation; 'Yes, revoke' removes the key from the list immediately (optimistic) and the row is gone on next page load"
    why_human: "Optimistic UI state transitions and row expansion behaviour require browser interaction"
  - test: "Integrations page tab switching"
    expected: "WhatsApp tab is active by default; switching to Telegram tab shows telegram snippet with '\"channel\": \"telegram\"'; webhook URL contains the correct bot ID from the URL"
    why_human: "Tab rendering and dynamic URL population require a real browser session"
  - test: "Copy buttons on Integrations page"
    expected: "Clicking copy on webhook URL and snippet blocks triggers icon swap (Copy to Check for 2 seconds); clipboard receives correct content"
    why_human: "navigator.clipboard.writeText requires browser permissions context"
---

# Phase 3: Webhook Gateway Verification Report

**Phase Goal:** Implement API key management — generation, validation, and admin UI — so external tools (n8n, custom bots) can authenticate against the chat endpoint using bearer tokens.
**Verified:** 2026-03-21T23:20:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | API key generation returns ethan_live_ prefix + 24 hex chars and stores only SHA-256 hash | VERIFIED | `lib/api-keys/generate.ts` exports `generateApiKey()` producing `ethan_live_${randomBytes(12).hex}` (35 chars); stores SHA-256 hash only; confirmed by 6 unit tests passing |
| 2 | API key listing returns label, key_prefix, last_used_at, created_at — never key_hash | VERIFIED | GET select clause: `'id, label, key_prefix, last_used_at, created_at'` — `key_hash` absent; unit test "does NOT return key_hash in response" passes |
| 3 | API key revocation sets revoked_at timestamp — never deletes the row | VERIFIED | DELETE handler calls `.update({ revoked_at: ... }).eq('id', keyId).eq('bot_id', botId).is('revoked_at', null)` — no hard delete; unit test "calls update (soft delete) not hard delete" passes |
| 4 | Chat endpoint validates against api_keys table first, falls back to bots.api_key_hash, preserves dev-mode null bypass | VERIFIED | `app/api/chat/[botId]/route.ts` lines 39-88: queries `api_keys` with `.maybeSingle()`, on hit uses `timingSafeEqual`, on miss falls back to `bot.api_key_hash`, preserves console.warn dev bypass when both null |
| 5 | last_used_at is updated on every successful api_keys validation (fire-and-forget) | VERIFIED | Lines 60-63: `supabase.from('api_keys').update({ last_used_at: ... }).eq('id', keyRow.id)` — not awaited, confirming fire-and-forget pattern |
| 6 | Admin can generate a labeled API key and see it in full exactly once in a modal | VERIFIED (automated) | `api-keys/page.tsx`: Dialog with `onInteractOutside={(e) => e.preventDefault()}` and `onEscapeKeyDown={(e) => e.preventDefault()}`; "I've copied this key" dismiss clears `generatedKey` from state; human verification required for runtime behaviour |
| 7 | Admin can view a list of active keys showing label, 8-char prefix, last-used timestamp, and creation date | VERIFIED (automated) | Key list table renders label, `Badge` with `key_prefix`, `last_used_at` (shows "Never" when null), `created_at` formatted date; fetched via `GET /api/keys/${botId}` on mount |
| 8 | Admin can revoke any key with inline confirmation | VERIFIED (automated) | Trash icon sets `revokingKeyId`; confirmation row shows "Revoke this key? Requests using it will immediately return 401." with destructive "Yes, revoke" and ghost "Keep key"; optimistic removal with error recovery |
| 9 | Integrations page shows webhook URL auto-populated with bot ID and n8n JSON snippets for WhatsApp and Telegram via tabs | VERIFIED (automated) | `window.location.origin + /api/chat/${botId}` in read-only input; `Tabs` with `defaultValue="whatsapp"`; both WhatsApp and Telegram snippets defined with correct `$json.message.*` expressions |

**Score:** 9/9 truths verified (4 items flagged for human runtime verification)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/00008_api_keys.sql` | api_keys table with RLS policies | VERIFIED | CREATE TABLE, 2 partial indexes, ENABLE ROW LEVEL SECURITY, CREATE POLICY present |
| `lib/api-keys/generate.ts` | Key generation utility | VERIFIED | Exports `generateApiKey`; 9 lines, fully implemented |
| `app/api/keys/[botId]/route.ts` | GET/POST/DELETE key management endpoints | VERIFIED | All 3 handlers present; params typed as `Promise<{ botId: string }>` (Next.js 16 compliant); 89 lines |
| `app/api/chat/[botId]/route.ts` | Updated validation block checking api_keys table first | VERIFIED | Contains `from('api_keys')`, `maybeSingle`, `last_used_at`, `timingSafeEqual` |
| `tests/api/keys.test.ts` | Unit tests for key generation, listing, revocation | VERIFIED | 17 tests across `generateApiKey()`, POST, GET, DELETE — all pass |
| `tests/api/chat-auth.test.ts` | Updated tests covering api_keys validation path | VERIFIED | Table-aware mock; 9 tests including api_keys path — all pass |
| `app/dashboard/bots/[botId]/api-keys/page.tsx` | API key management page | VERIFIED | 317 lines; `'use client'`; Dialog, generate form, list table, inline revoke — fully implemented |
| `app/dashboard/bots/[botId]/integrations/page.tsx` | Integrations page with webhook URL and n8n snippets | VERIFIED | 157 lines; `'use client'`; Tabs, ChannelTab component, both snippets, CopyButton — fully implemented |
| `components/ui/dialog.tsx` | shadcn Dialog (installed) | VERIFIED | File exists |
| `components/ui/tabs.tsx` | shadcn Tabs (installed) | VERIFIED | File exists |
| `components/ui/sonner.tsx` | shadcn Sonner toast (installed) | VERIFIED | File exists |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `app/api/keys/[botId]/route.ts` | `lib/api-keys/generate.ts` | `import generateApiKey` | WIRED | Line 2: `import { generateApiKey } from '@/lib/api-keys/generate'`; called in POST handler line 17 |
| `app/api/keys/[botId]/route.ts` | `lib/supabase/service.ts` | `createServiceClient` | WIRED | Line 1: `import { createServiceClient } from '@/lib/supabase/service'`; called in all 3 handlers |
| `app/api/chat/[botId]/route.ts` | `supabase api_keys table` | `supabase.from('api_keys').select` | WIRED | Lines 39-45: `.from('api_keys').select('id, key_hash').eq(...).is('revoked_at', null).maybeSingle()` |
| `app/dashboard/bots/[botId]/api-keys/page.tsx` | `/api/keys/[botId]` | `fetch` calls for POST, GET, DELETE | WIRED | `fetchKeys` uses `fetch('/api/keys/${botId}')` GET; `handleGenerate` uses POST; `handleRevoke` uses DELETE |
| `app/dashboard/bots/[botId]/integrations/page.tsx` | botId param | `useParams` | WIRED | Line 121-122: `const params = useParams(); const botId = params.botId as string`; used in `webhookUrl` construction |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| API-01 | 03-01, 03-02 | Admin can generate API key with label; shown once, hash stored; format `ethan_live_xxxxxxxxxxxxxxxx` | SATISFIED | `generateApiKey()` produces format; POST route returns plaintext once; only hash inserted into DB |
| API-02 | 03-01, 03-02 | Admin can view existing keys by label and 8-char prefix; last-used timestamp displayed | SATISFIED | GET route returns `{ id, label, key_prefix, last_used_at, created_at }`; UI renders all fields with "Never" fallback |
| API-03 | 03-01, 03-02 | Admin can revoke any API key | SATISFIED | DELETE route soft-deletes via `revoked_at`; UI inline revoke confirmation wired to DELETE endpoint |
| API-04 | 03-01 | Webhook endpoint validates API key using constant-time hash comparison on every request | SATISFIED | Chat endpoint: `timingSafeEqual` with length guard; checks api_keys table first with fallback to `bots.api_key_hash`; 9 passing auth tests |
| API-05 | 03-02 | Integrations page displays webhook URL and n8n JSON body snippets for Telegram and WhatsApp | SATISFIED | `integrations/page.tsx`: tab-based WhatsApp/Telegram switcher; auto-populated webhook URL; both n8n JSON snippets with copy buttons |

No orphaned requirements: REQUIREMENTS.md maps API-01 through API-05 to Phase 3, all claimed by plans 03-01 and 03-02.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `app/dashboard/bots/[botId]/api-keys/page.tsx` | 210 | HTML `placeholder` attribute on Input | Info | Not an anti-pattern — UI input hint text, expected |
| `app/dashboard/bots/[botId]/integrations/page.tsx` | 103 | "placeholder n8n expressions" in disclaimer text | Info | Not an anti-pattern — informational copy, expected |

No blockers or warnings found. All route handlers are fully implemented. No `return null`, `return {}`, `console.log`-only handlers, or TODO comments found in any phase file.

---

### Human Verification Required

#### 1. Generate API Key Modal — Show-Once Behaviour

**Test:** Log in as admin, navigate to `/dashboard/bots/[botId]/api-keys`, type a label (e.g. "n8n Production"), click "Generate Key"
**Expected:** Modal opens showing full `ethan_live_` key in mono font; clicking outside the modal or pressing Escape does nothing; clicking the copy icon swaps to a checkmark for 2 seconds then reverts; clicking "I've copied this key" closes the modal and the key row appears in the list below with its prefix badge
**Why human:** Modal dismiss-lock (`onInteractOutside`/`onEscapeKeyDown`), clipboard API, and icon-swap timing are runtime browser behaviours that cannot be verified statically

#### 2. Inline Revoke Confirmation

**Test:** From the key list, click the trash icon on any key row
**Expected:** A confirmation row expands below showing "Revoke this key? Requests using it will immediately return 401." with "Yes, revoke" (destructive) and "Keep key" (ghost) buttons; "Keep key" collapses the row; "Yes, revoke" immediately removes the key from the list (optimistic) and it does not reappear on refresh
**Why human:** Row expansion/collapse state and optimistic UI removal require browser interaction

#### 3. Integrations Page — Tab Switching and Webhook URL

**Test:** Navigate to `/dashboard/bots/[botId]/integrations`
**Expected:** WhatsApp tab is active by default showing webhook URL (`https://...domain.../api/chat/[botId]`) and WhatsApp JSON snippet; clicking "Telegram" tab switches snippet to show `"channel": "telegram"`; the bot ID in the webhook URL matches the bot ID in the page URL
**Why human:** Tab rendering and `window.location.origin` URL construction require a live browser session

#### 4. Copy Buttons on Integrations Page

**Test:** Click the copy button next to the webhook URL, then click copy buttons on the n8n snippet blocks
**Expected:** Clipboard receives the correct URL/JSON content; icon swaps from Copy to Check for 2 seconds then reverts; no toast is shown (icon swap is the only feedback)
**Why human:** `navigator.clipboard.writeText` requires browser permissions and a secure context

---

### Gaps Summary

No gaps found. All 9 truths are verified at all three levels (exists, substantive, wired). All 5 requirement IDs (API-01 through API-05) are fully satisfied. All 4 documented commit hashes exist in git history. The full test suite is green at 89/89. The only items pending are runtime visual behaviours that require a human browser session, which was already performed and approved by the user during Plan 02 Task 3 (checkpoint:human-verify gate).

---

_Verified: 2026-03-21T23:20:00Z_
_Verifier: Claude (gsd-verifier)_
