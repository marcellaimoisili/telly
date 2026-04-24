/**
 * Coefficient sensitivity analysis.
 *
 * The semantic-tuning.ts grid search uses a scoring formula:
 *   score = accuracy - (fpPenalty × falsePositives) - (fnPenalty × falseNegatives)
 *
 * But the penalty coefficients (fpPenalty, fnPenalty) are chosen, not derived.
 * This script tests whether the winning threshold (0.35) is stable across
 * a systematic grid of coefficient values, or whether it only wins with
 * specific assumptions about the relative cost of FP vs FN.
 *
 * If 0.35 wins across most coefficient combos, the threshold is robust.
 * If it only wins in a narrow band, we're overfitting to our assumptions.
 *
 * Run: OPENAI_API_KEY=... npx tsx lib/coefficient-sensitivity.ts
 */

import * as fs from "fs"
import * as path from "path"
import { cosineSimilarity } from "./similarity"

interface TestCase {
  speech: string
  expectedAnchorIndex: number
  label: string
}

interface ScriptTestData {
  name: string
  anchors: string[]
  testCases: TestCase[]
}

function loadTestScripts(): ScriptTestData[] {
  const dirs = [
    path.join(__dirname, "test-scripts", "real-world"),
    path.join(__dirname, "test-scripts", "asr-noisy"),
    path.join(__dirname, "test-scripts", "asr-real"),
  ]
  const scripts: ScriptTestData[] = []
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort()
    for (const file of files) {
      const data = JSON.parse(fs.readFileSync(path.join(dir, file), "utf-8"))
      scripts.push({ name: data.name, anchors: data.anchors, testCases: data.testCases })
    }
  }
  return scripts
}

async function main() {
  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey) {
    console.error("OPENAI_API_KEY not set")
    process.exit(1)
  }

  const scripts = loadTestScripts()
  const totalTests = scripts.reduce((sum, s) => sum + s.testCases.length, 0)

  console.log("\nCoefficient Sensitivity Analysis")
  console.log("=".repeat(80))
  console.log(`Scripts: ${scripts.length} | Test cases: ${totalTests}`)
  console.log("=".repeat(80))

  // ── Embed once ──────────────────────────────────────────────────────────────
  console.log("\nEmbedding anchors + test cases…")

  const anchorTexts = scripts.flatMap((s) => s.anchors)
  const anchorRes = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
    body: JSON.stringify({ input: anchorTexts, model: "text-embedding-3-small" }),
  })
  if (!anchorRes.ok) { console.error(await anchorRes.json()); process.exit(1) }
  const anchorEmbs = (await anchorRes.json()).data
    .sort((a: any, b: any) => a.index - b.index)
    .map((d: any) => d.embedding)

  const testEntries: { script: string; test: TestCase; emb?: number[] }[] = []
  for (const s of scripts) for (const tc of s.testCases) testEntries.push({ script: s.name, test: tc })

  const speechRes = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
    body: JSON.stringify({ input: testEntries.map((t) => t.test.speech), model: "text-embedding-3-small" }),
  })
  if (!speechRes.ok) { console.error(await speechRes.json()); process.exit(1) }
  const speechEmbs = (await speechRes.json()).data
    .sort((a: any, b: any) => a.index - b.index)
    .map((d: any) => d.embedding)
  for (let i = 0; i < testEntries.length; i++) testEntries[i].emb = speechEmbs[i]

  // ── Pre-compute per-threshold results ───────────────────────────────────────
  const thresholds = [0.10, 0.15, 0.20, 0.25, 0.30, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60, 0.65, 0.70, 0.75, 0.80]

  // For each threshold, compute accuracy, FP, FN once
  const thresholdStats: { threshold: number; accuracy: number; fp: number; fn: number }[] = []

  for (const threshold of thresholds) {
    let correct = 0, fp = 0, fn = 0

    for (const entry of testEntries) {
      const tc = entry.test
      const script = scripts.find((s) => s.name === entry.script)!

      let bestIdx = -1, bestScore = 0
      const wStart = Math.max(0, tc.expectedAnchorIndex - 1)
      const wEnd = Math.min(script.anchors.length, wStart + 3)

      let offset = 0
      for (const s of scripts) { if (s.name === entry.script) break; offset += s.anchors.length }

      for (let ai = wStart; ai < wEnd; ai++) {
        const score = cosineSimilarity(entry.emb!, anchorEmbs[offset + ai])
        if (score > bestScore) { bestScore = score; bestIdx = ai }
      }

      const matched = bestScore >= threshold ? bestIdx : -1

      if (tc.expectedAnchorIndex === -1) {
        matched !== -1 ? fp++ : correct++
      } else {
        matched === tc.expectedAnchorIndex ? correct++ : matched === -1 ? fn++ : fp++
      }
    }

    thresholdStats.push({ threshold, accuracy: correct / testEntries.length, fp, fn })
  }

  // ── Coefficient grid search ─────────────────────────────────────────────────
  // Systematic: FP penalty 0.01→0.10 (step 0.01), FN penalty 0.005→0.05 (step 0.005)
  const fpRange = [0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08, 0.09, 0.10]
  const fnRange = [0.005, 0.01, 0.015, 0.02, 0.025, 0.03, 0.035, 0.04, 0.045, 0.05]

  console.log(`\nCoefficient grid: ${fpRange.length} FP values × ${fnRange.length} FN values = ${fpRange.length * fnRange.length} combinations`)
  console.log(`Threshold grid: ${thresholds.length} values [${thresholds[0]}…${thresholds[thresholds.length - 1]}]`)
  console.log()

  // Track how often each threshold wins
  const winCounts: Record<number, number> = {}
  for (const t of thresholds) winCounts[t] = 0

  const rows: string[] = []

  for (const fpP of fpRange) {
    for (const fnP of fnRange) {
      let bestThreshold = 0
      let bestScore = -Infinity

      for (const stats of thresholdStats) {
        const score = stats.accuracy - fpP * stats.fp - fnP * stats.fn
        if (score > bestScore) {
          bestScore = score
          bestThreshold = stats.threshold
        }
      }

      winCounts[bestThreshold]++
      const ratio = (fpP / fnP).toFixed(1)
      rows.push(
        `FP=${fpP.toFixed(2)} FN=${fnP.toFixed(3)} ratio=${ratio.padStart(5)}x → best=${bestThreshold.toFixed(2)}`
      )
    }
  }

  // Print all rows
  for (const row of rows) {
    const threshold = parseFloat(row.split("best=")[1])
    const marker = threshold === 0.35 ? "✓" : " "
    console.log(`${marker} ${row}`)
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log()
  console.log("=".repeat(80))
  console.log("THRESHOLD WIN COUNTS")
  console.log("=".repeat(80))

  const totalCombos = fpRange.length * fnRange.length
  const sorted = Object.entries(winCounts)
    .filter(([, count]) => count > 0)
    .sort(([, a], [, b]) => b - a)

  for (const [threshold, count] of sorted) {
    const pct = ((count / totalCombos) * 100).toFixed(1)
    const bar = "█".repeat(Math.round(count / 2))
    console.log(`  threshold=${parseFloat(threshold).toFixed(2)} → wins ${count}/${totalCombos} (${pct}%) ${bar}`)
  }

  console.log()
  console.log("If one threshold dominates, it's robust regardless of coefficient choice.")
  console.log("If wins are spread, the threshold depends on coefficient assumptions.")
}

main().catch((err) => { console.error(err); process.exit(1) })
