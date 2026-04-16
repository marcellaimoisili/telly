/**
 * Splits a script into ~wordsPerChunk-word anchor strings.
 * Mirrors the teleprompter's line-splitting logic so pointer
 * indices map 1:1 to displayed lines.
 */
export function chunkScript(script: string, wordsPerChunk = 5): string[] {
  const words = script.split(/\s+/).filter(Boolean)
  const chunks: string[] = []

  for (let i = 0; i < words.length; i += wordsPerChunk) {
    chunks.push(words.slice(i, i + wordsPerChunk).join(" "))
  }

  return chunks
}
