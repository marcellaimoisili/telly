/**
 * Quick smoke test for chunk + similarity utilities.
 * Run: npx tsx lib/test-utils.ts
 */
import { chunkScript } from "./chunk"
import { cosineSimilarity, findBestMatch } from "./similarity"

let passed = 0
let failed = 0

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ✓ ${label}`)
    passed++
  } else {
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`)
    failed++
  }
}

// ── chunkScript ──────────────────────────────────────────

console.log("\nchunkScript")

const script = "To be or not to be that is the question whether tis nobler"
const chunks = chunkScript(script)
assert("splits into 5-word chunks", chunks.length === 3, `got ${chunks.length}`)
assert("first chunk correct", chunks[0] === "To be or not to", `got "${chunks[0]}"`)
assert("second chunk correct", chunks[1] === "be that is the question", `got "${chunks[1]}"`)
assert("last chunk is remainder", chunks[2] === "whether tis nobler", `got "${chunks[2]}"`)

assert("empty string returns []", chunkScript("").length === 0)
assert("whitespace-only returns []", chunkScript("   \n\t  ").length === 0)

const custom = chunkScript("a b c d e f g", 3)
assert("custom chunk size", custom.length === 3 && custom[0] === "a b c", `got ${JSON.stringify(custom)}`)

// ── cosineSimilarity ─────────────────────────────────────

console.log("\ncosineSimilarity")

assert("identical vectors → 1", cosineSimilarity([1, 0], [1, 0]) === 1)
assert("opposite vectors → -1", cosineSimilarity([1, 0], [-1, 0]) === -1)
assert("orthogonal vectors → 0", cosineSimilarity([1, 0], [0, 1]) === 0)
assert("zero vector → 0", cosineSimilarity([0, 0], [1, 2]) === 0)

const sim = cosineSimilarity([1, 2, 3], [1, 2, 3.1])
assert("near-identical → close to 1", sim > 0.999, `got ${sim}`)

// ── findBestMatch ────────────────────────────────────────

console.log("\nfindBestMatch")

// Simulate 4 anchors as simple 3D vectors
const anchors = [
  [1, 0, 0],   // anchor 0
  [0, 1, 0],   // anchor 1
  [0, 0, 1],   // anchor 2
  [0.9, 0.1, 0], // anchor 3 — similar to anchor 0
]

// Speech that matches anchor 2
const speech2 = [0.05, 0.05, 0.95]
const m1 = findBestMatch(speech2, anchors, 0, 5, 0.6)
assert("finds best match (anchor 2)", m1.index === 2, `got index ${m1.index}`)
assert("score above threshold", m1.score > 0.9, `got ${m1.score}`)

// Window starts at 2 → can only see anchors 2,3
const m2 = findBestMatch([0.9, 0.1, 0], anchors, 2, 5, 0.6)
assert("respects windowStart (skips anchor 0)", m2.index === 3, `got index ${m2.index}`)

// Nothing in window matches
const m3 = findBestMatch([0, 0, 1], anchors, 0, 2, 0.6)
// anchors 0 and 1 are orthogonal to [0,0,1] → below threshold
assert("returns -1 when below threshold", m3.index === -1, `got index ${m3.index}`)

// Window past end of array
const m4 = findBestMatch([1, 0, 0], anchors, 3, 10, 0.6)
assert("window clamped to array bounds", m4.index === 3, `got index ${m4.index}`)

// ── Summary ──────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed\n`)
process.exit(failed > 0 ? 1 : 0)
