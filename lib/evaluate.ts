/**
 * Evaluation harness: given script, transcript, and parameters,
 * measure how well the matching algorithm performs.
 */

import { chunkScript } from "./chunk"
import { localMatch, findBestMatch, wordOverlap, cosineSimilarity } from "./similarity"

export interface EvalResult {
  correctMatches: number
  totalMatches: number
  accuracy: number
  falsePositives: number
  falseNegatives: number
  pointerDeviation: number // avg distance from ground truth
}

/**
 * Find ground truth: which anchor index should the transcript align to?
 * Strategy: find the furthest word position from the transcript in the script.
 */
function findGroundTruthAnchor(
  script: string,
  transcript: string,
  anchors: string[]
): number {
  const scriptWords = script.toLowerCase().split(/\s+/).filter(Boolean)
  const transcriptWords = transcript.toLowerCase().split(/\s+/).filter(Boolean)

  // Find positions of transcript words in script
  let furthestScriptIdx = -1
  let transcriptIdx = 0

  for (let scriptIdx = 0; scriptIdx < scriptWords.length && transcriptIdx < transcriptWords.length; scriptIdx++) {
    if (scriptWords[scriptIdx].replace(/[^\w]/g, "") === transcriptWords[transcriptIdx].replace(/[^\w]/g, "")) {
      furthestScriptIdx = scriptIdx
      transcriptIdx++
    }
  }

  if (furthestScriptIdx === -1) return 0

  // Convert word position to anchor index
  const wordsPerChunk = 5
  return Math.min(Math.floor(furthestScriptIdx / wordsPerChunk), anchors.length - 1)
}

export interface EvalParams {
  localWindow: number
  localThreshold: number
  semanticWindow: number
  semanticThreshold: number
  minUnmatchedWords: number
}

/**
 * Simulate the matching pipeline for a single test case.
 * Returns: which anchor index the matcher settled on.
 */
function simulateMatching(
  script: string,
  transcript: string,
  anchors: string[],
  anchorEmbeddings: number[][],
  params: EvalParams
): number {
  let pointerIdx = 0
  const words = transcript.split(/\s+/).filter(Boolean)
  let consumedWords = 0

  // Simulate: process transcript in chunks (like real-time streaming)
  for (let i = consumedWords; i < words.length; i++) {
    const newWords = words.slice(consumedWords)
    if (newWords.length < 2) continue

    const newSpeech = newWords.join(" ")

    // Fast path: local match
    const local = localMatch(newSpeech, anchors, pointerIdx, params.localWindow, params.localThreshold)
    if (local !== -1) {
      pointerIdx = Math.min(local + 1, anchors.length - 1)
      consumedWords = i + 1
      continue
    }

    // Slow path: semantic match (we can't actually call OpenAI, so skip for now)
    // In a real scenario, you'd embed the speech and compare
  }

  return pointerIdx
}

export function evaluateParams(
  script: string,
  transcript: string,
  params: EvalParams,
  anchorEmbeddings?: number[][]
): EvalResult {
  const anchors = chunkScript(script)
  const groundTruth = findGroundTruthAnchor(script, transcript, anchors)
  const predicted = simulateMatching(script, transcript, anchors, anchorEmbeddings || [], params)

  const isCorrect = Math.abs(predicted - groundTruth) <= 1 // allow ±1 anchor tolerance
  const deviation = Math.abs(predicted - groundTruth)

  return {
    correctMatches: isCorrect ? 1 : 0,
    totalMatches: 1,
    accuracy: isCorrect ? 1 : 0,
    falsePositives: predicted > groundTruth ? 1 : 0,
    falseNegatives: predicted < groundTruth ? 1 : 0,
    pointerDeviation: deviation,
  }
}

export function evaluateParamsOnTestSuite(
  testCases: Array<{ script: string; transcript: string }>,
  params: EvalParams
): {
  avgAccuracy: number
  avgDeviation: number
  totalCorrect: number
  totalTests: number
} {
  let totalCorrect = 0
  let totalDeviation = 0

  for (const testCase of testCases) {
    const result = evaluateParams(testCase.script, testCase.transcript, params)
    totalCorrect += result.correctMatches
    totalDeviation += result.pointerDeviation
  }

  const totalTests = testCases.length

  return {
    avgAccuracy: totalCorrect / totalTests,
    avgDeviation: totalDeviation / totalTests,
    totalCorrect,
    totalTests,
  }
}
