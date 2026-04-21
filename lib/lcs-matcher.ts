/**
 * Longest Common Subsequence (LCS) based matching.
 * Replaces stop-word filtering approach with sequence-aware matching.
 *
 * Why LCS > word overlap:
 * - Word overlap destroys order (loses position info)
 * - LCS respects sequence (critical for teleprompter position tracking)
 * - Robust to poetry/filler-heavy text (Hamlet, etc.)
 */

/**
 * Compute Longest Common Subsequence length as a fraction of anchor length.
 * Uses dynamic programming.
 *
 * Time complexity: O(spokenLen × anchorLen)
 *   Typical: O(20 × 5) = 100 operations ≈ 20–50 microseconds
 * Space complexity: O(spokenLen × anchorLen)
 *   Typical: 100 integers ≈ 400 bytes
 *
 * Returns: 0.0 (no match) to 1.0 (perfect match)
 */
export function lcsMatchScore(spokenTranscript: string, anchorScript: string): number {
  // Normalize: lowercase, remove punctuation
  const normalizeWords = (text: string): string[] =>
    text
      .toLowerCase()
      .replace(/[^\w\s]/g, "") // Remove all punctuation
      .split(/\s+/) // Split on whitespace
      .filter(word => word.length > 0) // Remove empty strings

  const spokenWords = normalizeWords(spokenTranscript)
  const anchorWords = normalizeWords(anchorScript)

  const spokenLen = spokenWords.length
  const anchorLen = anchorWords.length

  // Edge case: if either is empty, no match possible
  if (spokenLen === 0 || anchorLen === 0) return 0

  // DP table: lcsTable[i][j] = LCS length of first i spoken words vs first j anchor words
  // Padding row 0 and column 0 represent "empty string" (always 0)
  const lcsTable = Array(spokenLen + 1)
    .fill(null)
    .map(() => Array(anchorLen + 1).fill(0))

  // Fill DP table
  for (let spokenIdx = 1; spokenIdx <= spokenLen; spokenIdx++) {
    for (let anchorIdx = 1; anchorIdx <= anchorLen; anchorIdx++) {
      const spokenWord = spokenWords[spokenIdx - 1]
      const anchorWord = anchorWords[anchorIdx - 1]

      if (spokenWord === anchorWord) {
        // Words match: extend the previous LCS by 1
        lcsTable[spokenIdx][anchorIdx] = lcsTable[spokenIdx - 1][anchorIdx - 1] + 1
      } else {
        // Words don't match: take the best option (skip spoken word or skip anchor word)
        const skipSpokenWord = lcsTable[spokenIdx - 1][anchorIdx]
        const skipAnchorWord = lcsTable[spokenIdx][anchorIdx - 1]
        lcsTable[spokenIdx][anchorIdx] = Math.max(skipSpokenWord, skipAnchorWord)
      }
    }
  }

  // Return LCS length as a fraction of anchor length (normalized score)
  const lcsLength = lcsTable[spokenLen][anchorLen]
  return lcsLength / anchorLen
}

/**
 * Fast-path matcher using LCS instead of stop-word filtering.
 * Checks anchors in a forward-only window.
 *
 * Returns: index of first anchor matching above threshold, or -1
 */
export function lcsLocalMatch(
  spokenText: string,
  anchors: string[],
  windowStart: number,
  windowSize: number = 1,
  threshold: number = 0.4
): number {
  const windowEnd = Math.min(windowStart + windowSize, anchors.length)

  for (let anchorIdx = windowStart; anchorIdx < windowEnd; anchorIdx++) {
    const matchScore = lcsMatchScore(spokenText, anchors[anchorIdx])
    if (matchScore >= threshold) {
      return anchorIdx
    }
  }

  return -1
}
