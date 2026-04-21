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
 * This script uses Hamlet (known script) + synthetically generated paraphrases/off-script samples,
 * then tunes on real OpenAI embeddings to preserve data-driven approach within time constraints.
 *
 * Run: OPENAI_API_KEY=... npx tsx lib/semantic-tuning.ts
 */

import { cosineSimilarity } from "./similarity"

export interface TestCase {
  speech: string
  expectedAnchorIndex: number
  label: string
}

export interface TuningResult {
  semanticThreshold: number
  accuracy: number
  falsePositives: number
  falseNegatives: number
  score: number
}

/**
 * Create test suite: Hamlet script + diverse test cases
 * Focus: paraphrases should match, off-script should NOT match
 */
function generateTestCases(): {
  anchors: string[]
  testCases: TestCase[]
} {
  const anchors = [
    "To be or not to be that is the question",
    "Whether tis nobler in the mind to suffer",
    "The slings and arrows of outrageous fortune",
    "Or to take arms against a sea of troubles",
    "And by opposing end them To die to sleep",
    "No more and by a sleep to say we end",
    "The heart ache and the thousand natural shocks",
    "That flesh is heir to tis a consummation",
    "Devoutly to be wishd To die to sleep",
    "To sleep perchance to dream ay theres the rub",
  ]

  const testCases: TestCase[] = []

  // === POSITIVE CASES (should match their anchor) ===

  // Exact reads
  testCases.push({
    speech: "To be or not to be that is the question",
    expectedAnchorIndex: 0,
    label: "exact",
  })
  testCases.push({
    speech: "Whether tis nobler in the mind to suffer",
    expectedAnchorIndex: 1,
    label: "exact",
  })
  testCases.push({
    speech: "Or to take arms against a sea of troubles",
    expectedAnchorIndex: 3,
    label: "exact",
  })
  testCases.push({
    speech: "To sleep perchance to dream ay theres the rub",
    expectedAnchorIndex: 9,
    label: "exact",
  })

  // Paraphrases (reader's interpretation - should still match correct anchor)
  testCases.push({
    speech: "The question of whether to exist or not exist",
    expectedAnchorIndex: 0,
    label: "paraphrase",
  })
  testCases.push({
    speech: "Is it nobler to endure mental suffering in silence",
    expectedAnchorIndex: 1,
    label: "paraphrase",
  })
  testCases.push({
    speech: "Life's cruel hardships and misfortunes",
    expectedAnchorIndex: 2,
    label: "paraphrase",
  })
  testCases.push({
    speech: "Take up arms against troubles and overcome them by fighting",
    expectedAnchorIndex: 3,
    label: "paraphrase",
  })
  testCases.push({
    speech: "Rest eternally perhaps with dreams that is the hesitation",
    expectedAnchorIndex: 9,
    label: "paraphrase",
  })

  // Minor ASR errors / variations
  testCases.push({
    speech: "To be or not to be that is the question",
    expectedAnchorIndex: 0,
    label: "asr-variation",
  })
  testCases.push({
    speech: "Whether it is nobler in the mind to suffer",
    expectedAnchorIndex: 1,
    label: "asr-variation",
  })

  // === NEGATIVE CASES (should NOT match anything - false positives are bad!) ===

  // Completely off-script
  testCases.push({
    speech: "The quick brown fox jumps over the lazy dog",
    expectedAnchorIndex: -1,
    label: "off-script",
  })
  testCases.push({
    speech: "I am reading from a different book entirely",
    expectedAnchorIndex: -1,
    label: "off-script",
  })
  testCases.push({
    speech: "Hello world this is a test message",
    expectedAnchorIndex: -1,
    label: "off-script",
  })
  testCases.push({
    speech: "The weather today is quite nice and sunny",
    expectedAnchorIndex: -1,
    label: "off-script",
  })
  testCases.push({
    speech: "Machine learning and artificial intelligence",
    expectedAnchorIndex: -1,
    label: "off-script",
  })

  return { anchors, testCases }
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

  const { anchors, testCases } = generateTestCases()

  console.log("\nSemantic Parameter Tuning")
  console.log("=".repeat(70))
  console.log(`Script: Hamlet (${anchors.length} anchors)`)
  console.log(
    `Test cases: ${testCases.length} (exact, paraphrases, off-script)`
  )
  console.log("Goal: Maximize paraphrase matches, minimize false positives")
  console.log("=".repeat(70))
  console.log()

  // Embed all anchors
  console.log("Embedding script anchors...")
  const anchorsRes = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      input: anchors,
      model: "text-embedding-3-small",
    }),
  })

  if (!anchorsRes.ok) {
    console.error("Failed to embed anchors:", await anchorsRes.json())
    process.exit(1)
  }

  const anchorsData = await anchorsRes.json()
  const anchorEmbeddings = anchorsData.data
    .sort((a: any, b: any) => a.index - b.index)
    .map((item: any) => item.embedding)

  // Embed all test cases
  console.log("Embedding test cases...")
  const speechTexts = testCases.map((tc) => tc.speech)
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
  const speechEmbeddings = speechData.data
    .sort((a: any, b: any) => a.index - b.index)
    .map((item: any) => item.embedding)

  console.log()
  console.log("Grid search (penalizing false positives heavily)...")
  console.log()

  const thresholds = [0.25, 0.30, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60]

  let bestResult: TuningResult | null = null

  for (const threshold of thresholds) {
    let correctMatches = 0
    let falsePositives = 0
    let falseNegatives = 0

    for (let speechIdx = 0; speechIdx < testCases.length; speechIdx++) {
      const testCase = testCases[speechIdx]
      const speechEmbedding = speechEmbeddings[speechIdx]

      // Find best match in window
      let bestMatchIndex = -1
      let bestScore = 0

      const windowStart = Math.max(0, testCase.expectedAnchorIndex - 1)
      const windowEnd = Math.min(anchors.length, windowStart + 3)

      for (let anchorIdx = windowStart; anchorIdx < windowEnd; anchorIdx++) {
        const score = cosineSimilarity(
          speechEmbedding,
          anchorEmbeddings[anchorIdx]
        )
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

    const accuracy = correctMatches / testCases.length
    // Heavy penalty for false positives (they're worse than false negatives)
    const score = accuracy - falsePositives * 0.5
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

  console.log()
  console.log("=".repeat(70))
  console.log("TUNING COMPLETE")
  console.log("=".repeat(70))
  console.log()
  console.log(`Best Parameters (zero false positives preferred):`)
  console.log(`   Semantic Threshold: ${bestResult!.semanticThreshold.toFixed(2)}`)
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
