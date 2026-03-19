/**
 * Patch voyageai ESM bundle to add explicit .mjs extensions to relative imports.
 * voyageai@0.2.x ships an ESM build with directory imports (e.g. "../api") which
 * Node.js ESM strict resolver (Node 18+) does not support.
 *
 * Run via: node scripts/patch-voyageai-esm.cjs
 * Wired via postinstall in package.json.
 */
const fs = require('fs')
const path = require('path')

const ESM_DIR = path.join(__dirname, '..', 'node_modules', 'voyageai', 'dist', 'esm')

if (!fs.existsSync(ESM_DIR)) {
  console.log('[patch-voyageai-esm] voyageai not installed yet, skipping.')
  process.exit(0)
}

// Files with broken imports and their fixes
const patches = [
  {
    file: 'extended/index.mjs',
    replacements: [
      ['export * from "../api";', 'export * from "../api/index.mjs";'],
      ['export * from "../errors";', 'export * from "../errors/index.mjs";'],
      ['export { VoyageAIClient } from "./ExtendedClient";', 'export { VoyageAIClient } from "./ExtendedClient.mjs";'],
      ['export { VoyageAIClient as GeneratedVoyageAIClient } from "../Client";', 'export { VoyageAIClient as GeneratedVoyageAIClient } from "../Client.mjs";'],
      ['export { localEmbed, isLocalModel } from "../local";', 'export { localEmbed, isLocalModel } from "../local/index.mjs";'],
    ],
  },
  {
    file: 'extended/ExtendedClient.mjs',
    replacements: [
      ['from "../Client"', 'from "../Client.mjs"'],
      ['from "../core/fetcher/HttpResponsePromise"', 'from "../core/fetcher/HttpResponsePromise.mjs"'],
      ['from "../core/fetcher/RawResponse"', 'from "../core/fetcher/RawResponse.mjs"'],
      ['from "../local"', 'from "../local/index.mjs"'],
      ['from "../local/tokenizer"', 'from "../local/tokenizer.mjs"'],
    ],
  },
  {
    file: 'local/index.mjs',
    replacements: [
      ['from "./local-embedder"', 'from "./local-embedder.mjs"'],
      ['from "./tokenizer"', 'from "./tokenizer.mjs"'],
      ['from "./model-registry"', 'from "./model-registry.mjs"'],
    ],
  },
  {
    file: 'local/local-embedder.mjs',
    replacements: [
      ['from "./model-registry"', 'from "./model-registry.mjs"'],
      ['from "./tokenizer"', 'from "./tokenizer.mjs"'],
    ],
  },
]

let patchedCount = 0

for (const { file, replacements } of patches) {
  const filePath = path.join(ESM_DIR, file)
  if (!fs.existsSync(filePath)) {
    console.log(`[patch-voyageai-esm] Skipping ${file} — not found.`)
    continue
  }
  let content = fs.readFileSync(filePath, 'utf-8')
  let changed = false
  for (const [from, to] of replacements) {
    if (content.includes(from)) {
      content = content.split(from).join(to)
      changed = true
    }
  }
  if (changed) {
    fs.writeFileSync(filePath, content, 'utf-8')
    console.log(`[patch-voyageai-esm] Patched ${file}`)
    patchedCount++
  } else {
    console.log(`[patch-voyageai-esm] ${file} already patched or no matches.`)
  }
}

console.log(`[patch-voyageai-esm] Done. ${patchedCount} file(s) patched.`)
