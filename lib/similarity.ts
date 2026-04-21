/**
 * Cosine similarity between two vectors of equal length.
 * Returns a value in [-1, 1]. Returns 0 for zero-magnitude vectors.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0
  let magA = 0
  let magB = 0

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    magA += a[i] * a[i]
    magB += b[i] * b[i]
  }

  const denom = Math.sqrt(magA) * Math.sqrt(magB)
  if (denom === 0) return 0

  return dot / denom
}

export interface MatchResult {
  index: number
  score: number
}

/**
 * Finds the best-matching anchor within a forward-only sliding window.
 *
 * - Only searches anchors from windowStart to windowStart + windowSize - 1.
 * - Never returns an index behind windowStart (no backward pointer movement).
 * - Returns { index: -1, score: 0 } if no anchor exceeds the threshold.
 */
export function findBestMatch(
  speechEmbedding: number[],
  anchorEmbeddings: number[][],
  windowStart: number,
  windowSize = 5,
  threshold = 0.6
): MatchResult {
  const windowEnd = Math.min(windowStart + windowSize, anchorEmbeddings.length)

  let bestIndex = -1
  let bestScore = 0

  for (let i = windowStart; i < windowEnd; i++) {
    const score = cosineSimilarity(speechEmbedding, anchorEmbeddings[i])
    if (score > bestScore) {
      bestScore = score
      bestIndex = i
    }
  }

  if (bestScore < threshold) {
    return { index: -1, score: bestScore }
  }

  return { index: bestIndex, score: bestScore }
}
