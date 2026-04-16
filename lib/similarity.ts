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

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "is", "it", "that", "this", "was", "are", "be",
  "have", "has", "had", "do", "does", "did", "not", "so", "if", "my",
  "your", "i", "you", "we", "they", "he", "she", "me", "us", "them",
  "its", "from", "as", "no", "up", "out", "all", "just", "about",
])

/**
 * Fast local word overlap between spoken text and an anchor.
 * Filters stop words so only content words drive the match.
 * Returns the fraction of content anchor words found in speech (0-1).
 */
export function wordOverlap(spoken: string, anchor: string): number {
  const spokenWords = new Set(
    spoken
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .split(/\s+/)
      .filter((w) => w && !STOP_WORDS.has(w))
  )
  const anchorWords = anchor
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter((w) => w && !STOP_WORDS.has(w))

  if (anchorWords.length === 0) return 0

  let hits = 0
  for (const w of anchorWords) {
    if (spokenWords.has(w)) hits++
  }

  return hits / anchorWords.length
}

/**
 * Fast-path matcher: checks word overlap against anchors in a forward window.
 * Returns the index of the first anchor with overlap >= threshold, or -1.
 */
export function localMatch(
  spokenText: string,
  anchors: string[],
  windowStart: number,
  windowSize = 5,
  threshold = 0.5
): number {
  const windowEnd = Math.min(windowStart + windowSize, anchors.length)

  for (let i = windowStart; i < windowEnd; i++) {
    if (wordOverlap(spokenText, anchors[i]) >= threshold) {
      return i
    }
  }

  return -1
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
