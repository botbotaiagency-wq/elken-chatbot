# Testing Patterns

**Analysis Date:** 2026-04-02

## Test Framework

**Runner:** Vitest 4.1.0
- Config: `vitest.config.ts`
- Environment: `node` (not jsdom)
- Globals: enabled (`globals: true`) — `describe`, `it`, `expect`, `vi`, `beforeEach` available without importing from `vitest` in tests (though tests explicitly import them anyway)
- Setup file: `tests/setup.ts`

**Assertion Library:** Vitest built-in (`expect`)

**Coverage:**
- Provider: `v8` (`@vitest/coverage-v8`)
- Coverage scope: `lib/**/*.ts` only — API route handlers in `app/api/` are not included in coverage scope

**Run Commands:**
```bash
# No test scripts in package.json — run via npx or local bin:
npx vitest                  # Run all tests
npx vitest --watch          # Watch mode
npx vitest --coverage       # With v8 coverage report
npx vitest run              # Single run (CI mode)
```

Note: `package.json` has no `"test"` script defined. Tests must be invoked via `npx vitest` directly.

## Test File Organization

**Location:** All tests live in a separate `tests/` directory — NOT co-located with source files.

**Structure:**
```
tests/
├── setup.ts          # Global env var stubs
├── api/              # Route handler integration tests
│   ├── analytics.test.ts
│   ├── chat-auth.test.ts
│   ├── chat.test.ts
│   ├── config.test.ts
│   ├── faqs.test.ts
│   ├── keys.test.ts
│   ├── products.test.ts
│   ├── templates.test.ts
│   └── test-chat.test.ts
└── lib/              # Library unit tests
    ├── chunker.test.ts
    ├── csv.test.ts
    ├── detect.test.ts
    ├── embedder.test.ts
    ├── extractor.test.ts
    ├── logger.test.ts
    └── retrieve.test.ts
```

**Naming:** `<module-name>.test.ts` matching the source file name.

**Vitest include glob:** `tests/**/*.test.ts`

## Test Structure

**Suite organization:**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('functionName or route description', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Re-establish default mock return values after clearAllMocks
    mockFn.mockResolvedValue({ data: ..., error: null })
  })

  it('describes the expected behavior', async () => {
    const result = await functionUnderTest(args)
    expect(result).toEqual(expected)
  })
})
```

**Multiple describe blocks per file:** Grouping by HTTP method or function variant is common:
```typescript
describe('GET /api/keys/[botId]', () => { ... })
describe('POST /api/keys/[botId]', () => { ... })
describe('DELETE /api/keys/[botId]', () => { ... })
```

## Mocking

**Framework:** Vitest's `vi.mock()` and `vi.hoisted()`

**Critical pattern — `vi.hoisted()` for mock factories:**
All mock function references MUST be declared with `vi.hoisted()` when they need to be referenced inside `vi.mock()` factory closures. This is used consistently across every test file that mocks external dependencies:

```typescript
const { mockCreate } = vi.hoisted(() => {
  return { mockCreate: vi.fn() }
})

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn(function (this: unknown) {
      return { messages: { create: mockCreate } }
    }),
  }
})
```

**Module mocking patterns:**

*Supabase client (service role):*
```typescript
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      // Route to separate mock functions per table
      if (table === 'bots') { return { select: () => ({ eq: () => ({ single: mockBotsSelect }) }) } }
      if (table === 'api_keys') { return { ... } }
    }
  })
}))
```

*Chain mock pattern for simpler cases:*
```typescript
const chain: Record<string, unknown> = {}
chain.eq = vi.fn(() => chain)
chain.select = vi.fn(() => chain)
chain.from = vi.fn(() => chain)
```

*Anthropic SDK:*
```typescript
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(function (this: unknown) {
    return { messages: { create: mockAnthropicCreate } }
  }),
}))
```

*VoyageAI:*
```typescript
vi.mock('voyageai', () => ({
  VoyageAIClient: vi.fn(function (this: unknown) {
    return { embed: mockEmbed }
  }),
}))
```

**What is mocked:**
- All external API calls (Anthropic, VoyageAI)
- All Supabase database calls (`@/lib/supabase/service` and `@supabase/supabase-js`)
- Internal lib modules when testing higher-level code (e.g., `@/lib/rag/detect` mocked in `chat.test.ts`)

**What is NOT mocked:**
- Pure utility functions like `chunkText` in `chunker.ts` — tested with real inputs
- `generateApiKey()` in `lib/api-keys/generate.ts` — tested directly with real crypto
- `extractTxt` — tested with real Buffers

## Global Test Setup

**`tests/setup.ts`** — loaded via `vitest.config.ts` `setupFiles`:
```typescript
process.env.VOYAGE_API_KEY = 'test-voyage-key'
process.env.ANTHROPIC_API_KEY = 'test-anthropic-key'
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
```

All env vars required by the app are stubbed here so individual tests don't need to set them.

## Test Data / Fixtures

**No fixture files or factory helpers.** Test data is defined inline within each test:
```typescript
const faqMatch = {
  id: 'faq-1',
  question: 'What are your operating hours?',
  answer: 'We are open 9am-6pm Monday to Friday.',
  language: 'en',
  similarity: 0.92,
}
```

**Helper functions for request construction** are defined per test file to reduce boilerplate:
```typescript
function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/chat/bot-123', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeParams(botId = 'bot-123') {
  return { params: Promise.resolve({ botId }) }
}
```

This pattern (`makeRequest` + `makeParams`) appears in `chat.test.ts`, `chat-auth.test.ts`, `keys.test.ts`, and `products.test.ts`.

## Async Testing

**Pattern:** Standard `async/await` with `await expect(...).rejects.toEqual(...)` for error cases:
```typescript
it('throws and logs error when Supabase insert fails', async () => {
  mockSingle.mockResolvedValue({ data: null, error: supabaseError })
  await expect(logMessage({ ... })).rejects.toEqual(supabaseError)
})
```

**Streaming tests** use async generators to simulate the Anthropic stream:
```typescript
async function* makeStreamEvents(textChunks: string[]) {
  for (const text of textChunks) {
    yield { type: 'content_block_delta', delta: { type: 'text_delta', text } }
  }
}
mockAnthropicCreate.mockResolvedValue(makeStreamEvents(['Hello ', 'there!']))
```

## Test Coverage

**What is well-tested (real assertions):**

| Module | File | Coverage |
|--------|------|----------|
| `lib/rag/detect.ts` | `tests/lib/detect.test.ts` | Full: happy path, language normalization, intent normalization, invalid JSON fallback |
| `lib/rag/logger.ts` | `tests/lib/logger.test.ts` | Full: insert, error throw, getOrCreate all branches |
| `lib/rag/retrieve.ts` | `tests/lib/retrieve.test.ts` | Full: all intent branches, empty results, RPC call params |
| `lib/ingest/embedder.ts` | `tests/lib/embedder.test.ts` | Full: document chunks, query embedding, empty input guard |
| `lib/ingest/extractor.ts` | `tests/lib/extractor.test.ts` | Full: txt, pdf (happy + scanned), docx |
| `lib/ingest/chunker.ts` | `tests/lib/chunker.test.ts` | Full: edge cases, overlap math, token counts |
| `lib/api-keys/generate.ts` + `app/api/keys/[botId]/route.ts` | `tests/api/keys.test.ts` | Full: POST/GET/DELETE CRUD, key format, SHA-256 hash verification |
| `app/api/chat/[botId]/route.ts` — core flow | `tests/api/chat.test.ts` | Good: validation, headers, intent/rag routing |
| `app/api/chat/[botId]/route.ts` — auth | `tests/api/chat-auth.test.ts` | Full: all auth paths, api_keys table, fallback, dev mode |
| `app/api/products/[botId]/route.ts` | `tests/api/products.test.ts` | Good: single product, CSV bulk import, GET list |

**What has placeholder/stub tests only (`it.todo` or `expect(true).toBe(true)`):**

| File | Status |
|------|--------|
| `tests/api/faqs.test.ts` | All `it.todo` — no real assertions |
| `tests/api/templates.test.ts` | All `it.todo` — no real assertions |
| `tests/api/config.test.ts` | All `it.todo` — no real assertions |
| `tests/api/test-chat.test.ts` | All `it.todo` — no real assertions |
| `tests/api/analytics.test.ts` | Placeholder `expect(true).toBe(true)` throughout |
| `tests/lib/csv.test.ts` | Placeholder `expect(true).toBe(true)` — `lib/analytics/csv.ts` not yet built |

**Not tested at all:**
- `lib/booking/state-machine.ts` — no test file
- `lib/booking/slot-checker.ts` — no test file
- `lib/booking/google-calendar.ts` — no test file
- `lib/booking/notifications.ts` — no test file
- `lib/rag/prompt.ts` — no test file (mocked in chat tests)
- `lib/rag/transcribe.ts` — no test file
- `app/api/ingest/` routes — no test file
- `app/api/bookings/` routes — no test file
- All dashboard UI components in `components/` — no test files

## CI Testing

No CI pipeline configuration detected (no `.github/workflows/`, no `circle.ci`, no `vercel.json` test hooks). Testing is entirely manual/local.

---

*Testing analysis: 2026-04-02*
