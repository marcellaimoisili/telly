/**
 * Semantic parameter tuning: Find optimal threshold to maximize paraphrase matches
 * while minimizing false positives (off-script text matching wrong anchor).
 *
 * Real-world datasets researched for ground-truth tuning:
 * - LibriSpeech (https://www.openslr.org/12): 1000+ hours audiobooks with transcripts.
 *   Problem: Huge dataset, slow to parse. Perfect script/speech pairing but access limited.
 *
 * - SCOTUS (https://github.com/noajshu/scotus-speech): Supreme Court oral arguments.
 *   Problem: Has recorded speech + transcripts, but no original prepared briefs to compare against.
 *   Only what was actually spoken is captured, not the intended script.
 *
 * - TED-LIUM (https://huggingface.co/datasets/LIUM/tedlium): 2351 talks with auto-aligned transcriptions.
 *   Problem: Has transcripts of what speakers said, but no prepared speaker notes.
 *
 * - StoryMovie (https://arxiv.org/abs/2602.21829): 1757 movies with script/subtitle alignment using LCS.
 *   Problem: Movie context differs from teleprompter reading (actors improvise, edit during post-production).
 *
 * Core challenge: Most speech datasets capture what was *said*, not what was *supposed to be said*.
 * This script uses complete test scripts (Hamlet, Wasabi, Shoes etc.) with cross-domain off-script samples
 * to test against false positives, then tunes on real OpenAI embeddings to preserve data-driven approach.
 *
 * Run: OPENAI_API_KEY=... npx tsx lib/semantic-tuning.ts
 */

import * as fs from "fs"
import * as path from "path"
import { cosineSimilarity } from "./similarity"

export interface TestCase {
  speech: string
  expectedAnchorIndex: number
  label: string
}

export interface ScriptTestData {
  name: string
  anchors: string[]
  testCases: TestCase[]
}

export interface TuningResult {
  semanticThreshold: number
  accuracy: number
  falsePositives: number
  falseNegatives: number
  score: number
}

/**
 * Load test script JSON files from lib/test-scripts/real-world/
 */
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

async function semanticTuning(): Promise<TuningResult> {
  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey) {
    console.error("OPENAI_API_KEY not set")
    console.error(
      "   Run: OPENAI_API_KEY=sk-... npx tsx lib/semantic-tuning.ts"
    )
    process.exit(1)
  }

  const scripts = loadTestScripts()

  console.log("\nSemantic Parameter Tuning (Cross-Domain)")
  console.log("=".repeat(70))
  console.log(`Scripts loaded: ${scripts.map((s) => s.name).join(", ")}`)
  let totalTestCases = 0
  for (const script of scripts) {
    totalTestCases += script.testCases.length
  }
  console.log(
    `Total test cases: ${totalTestCases} (exact, paraphrases, cross-domain off-script)`
  )
  console.log("Goal: Maximize paraphrase matches, minimize false positives")
  console.log("=".repeat(70))
  console.log()

  // Embed all anchors from all scripts
  console.log("Embedding script anchors...")
  const allAnchors: { script: string; anchors: string[] }[] = []
  for (const script of scripts) {
    allAnchors.push({ script: script.name, anchors: script.anchors })
  }

  const anchorsRes = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      input: scripts.flatMap((s) => s.anchors),
      model: "text-embedding-3-small",
    }),
  })

  if (!anchorsRes.ok) {
    console.error("Failed to embed anchors:", await anchorsRes.json())
    process.exit(1)
  }

  const anchorsData = await anchorsRes.json()
  const allAnchorEmbeddings = anchorsData.data
    .sort((a: any, b: any) => a.index - b.index)
    .map((item: any) => item.embedding)

  // Embed all test cases from all scripts
  console.log("Embedding test cases...")
  const allTestCases: { script: string; test: TestCase; embedding?: number[] }[] =
    []
  for (const script of scripts) {
    for (const testCase of script.testCases) {
      allTestCases.push({ script: script.name, test: testCase })
    }
  }

  const speechTexts = allTestCases.map((tc) => tc.test.speech)
  const speechRes = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      input: speechTexts,
      model: "text-embedding-3-small",
    }),
  })

  if (!speechRes.ok) {
    console.error("Failed to embed speeches:", await speechRes.json())
    process.exit(1)
  }

  const speechData = await speechRes.json()
  const allSpeechEmbeddings = speechData.data
    .sort((a: any, b: any) => a.index - b.index)
    .map((item: any) => item.embedding)

  for (let i = 0; i < allTestCases.length; i++) {
    allTestCases[i].embedding = allSpeechEmbeddings[i]
  }

  console.log()
  console.log("Grid search (penalizing false positives heavily)...")
  console.log()

  const thresholds = [0.10, 0.15, 0.20, 0.25, 0.30, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60, 0.65, 0.70, 0.75, 0.80]

  let bestResult: TuningResult | null = null

  for (const threshold of thresholds) {
    let correctMatches = 0
    let falsePositives = 0
    let falseNegatives = 0

    // Test each test case against the correct script's anchors
    for (const testEntry of allTestCases) {
      const testCase = testEntry.test
      const scriptName = testEntry.script
      const speechEmbedding = testEntry.embedding!

      // Find the anchors for this script
      const script = scripts.find((s) => s.name === scriptName)!
      const anchors = script.anchors

      // Find best match in window
      let bestMatchIndex = -1
      let bestScore = 0

      const windowStart = Math.max(0, testCase.expectedAnchorIndex - 1)
      const windowEnd = Math.min(anchors.length, windowStart + 3)

      // Calculate offset to find correct embeddings
      let anchorOffset = 0
      for (const s of scripts) {
        if (s.name === scriptName) break
        anchorOffset += s.anchors.length
      }

      for (let anchorIdx = windowStart; anchorIdx < windowEnd; anchorIdx++) {
        const embeddingIdx = anchorOffset + anchorIdx
        const score = cosineSimilarity(speechEmbedding, allAnchorEmbeddings[embeddingIdx])
        if (score > bestScore) {
          bestScore = score
          bestMatchIndex = anchorIdx
        }
      }

      const matched = bestScore >= threshold ? bestMatchIndex : -1

      if (testCase.expectedAnchorIndex === -1) {
        // Off-script case: should NOT match
        if (matched !== -1) {
          falsePositives++ // BAD: matched when shouldn't
        } else {
          correctMatches++ // GOOD: correctly rejected
        }
      } else {
        // On-script case: should match expected anchor
        if (matched === testCase.expectedAnchorIndex) {
          correctMatches++ // GOOD: correct match
        } else if (matched === -1) {
          falseNegatives++ // BAD: missed the match
        } else {
          falsePositives++ // BAD: matched wrong anchor
        }
      }
    }

    const accuracy = correctMatches / allTestCases.length
    // FP is 2x worse than FN (validated: 0.35 wins unanimously at 1.5x–3.0x ratio)
    // See coefficient-sensitivity.ts for full analysis across 100 FP/FN combinations
    const score = accuracy - falsePositives * 0.04 - falseNegatives * 0.02
    const result: TuningResult = {
      semanticThreshold: threshold,
      accuracy,
      falsePositives,
      falseNegatives,
      score,
    }

    if (!bestResult || result.score > bestResult.score) {
      bestResult = result
    }

    const marker =
      falsePositives === 0 && accuracy >= 0.8
        ? "✅"
        : falsePositives === 0
          ? "⚠️"
          : "❌"
    console.log(
      `${marker} threshold=${threshold.toFixed(2)} → ` +
        `accuracy=${(accuracy * 100).toFixed(1)}% fp=${falsePositives} fn=${falseNegatives} score=${score.toFixed(3)}`
    )
  }

  // Debug: Show which test cases fail for best threshold
  console.log()
  console.log("=".repeat(70))
  console.log("FAILURE ANALYSIS FOR BEST THRESHOLD")
  console.log("=".repeat(70))
  const bestThreshold = bestResult!.semanticThreshold
  for (const testEntry of allTestCases) {
    const testCase = testEntry.test
    const scriptName = testEntry.script
    const speechEmbedding = testEntry.embedding!

    const script = scripts.find((s) => s.name === scriptName)!
    const anchors = script.anchors

    let bestMatchIndex = -1
    let bestScore = 0

    const windowStart = Math.max(0, testCase.expectedAnchorIndex - 1)
    const windowEnd = Math.min(anchors.length, windowStart + 3)

    let anchorOffset = 0
    for (const s of scripts) {
      if (s.name === scriptName) break
      anchorOffset += s.anchors.length
    }

    for (let anchorIdx = windowStart; anchorIdx < windowEnd; anchorIdx++) {
      const embeddingIdx = anchorOffset + anchorIdx
      const score = cosineSimilarity(speechEmbedding, allAnchorEmbeddings[embeddingIdx])
      if (score > bestScore) {
        bestScore = score
        bestMatchIndex = anchorIdx
      }
    }

    const matched = bestScore >= bestThreshold ? bestMatchIndex : -1

    let failureType = ""
    if (testCase.expectedAnchorIndex === -1) {
      if (matched !== -1) {
        failureType = "FALSE POSITIVE"
      }
    } else {
      if (matched !== testCase.expectedAnchorIndex) {
        failureType = matched === -1 ? "FALSE NEGATIVE" : "WRONG ANCHOR"
      }
    }

    if (failureType) {
      console.log(
        `   ${failureType}: "${testCase.speech.substring(0, 50)}..." ` +
          `(${scriptName}, ${testCase.label}, expected=${testCase.expectedAnchorIndex}, matched=${matched}, score=${bestScore.toFixed(3)})`
      )
    }
  }

  console.log()
  console.log("=".repeat(70))
  console.log("TUNING COMPLETE")
  console.log("=".repeat(70))
  console.log()
  console.log(`Best Parameters (accuracy-first, FP 2x worse than FN):`)
  console.log(
    `   Semantic Threshold: ${bestResult!.semanticThreshold.toFixed(2)}`
  )
  console.log(`   Accuracy: ${(bestResult!.accuracy * 100).toFixed(1)}%`)
  console.log(`   False Positives: ${bestResult!.falsePositives}`)
  console.log(`   False Negatives: ${bestResult!.falseNegatives}`)
  console.log()
  console.log(`Update app/page.tsx line 90:`)
  console.log(`   ${bestResult!.semanticThreshold.toFixed(2)}`)
  console.log()

  return bestResult!
}

semanticTuning().catch((err) => {
  console.error(err)
  process.exit(1)
})
