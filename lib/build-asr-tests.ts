/**
 * Build real-ASR test cases from Open Speech Repository audio + Deepgram transcription.
 *
 * Source: Harvard Sentences (IEEE 297-1969) read by real speakers,
 * transcribed by Deepgram Nova-2. Real ASR errors, not simulated.
 *
 * Source: https://www.voiptroubleshooter.com/open_speech/american.html
 * License: "Materials may be copied, downloaded, broadcast" with attribution to Open Speech Repository.
 */

import * as fs from "fs"
import * as path from "path"

function chunkScript(script: string, wordsPerChunk = 5): string[] {
  const words = script.split(/\s+/).filter(Boolean)
  const chunks: string[] = []
  for (let i = 0; i < words.length; i += wordsPerChunk) {
    chunks.push(words.slice(i, i + wordsPerChunk).join(" "))
  }
  return chunks
}

function findBestAnchor(speech: string, anchors: string[]): number {
  const speechWords = speech.toLowerCase().split(/\s+/)
  let bestIdx = 0
  let bestOverlap = 0

  for (let i = 0; i < anchors.length; i++) {
    const anchorWords = new Set(anchors[i].toLowerCase().split(/\s+/))
    let overlap = 0
    for (const w of speechWords) {
      if (anchorWords.has(w)) overlap++
    }
    // Weight by position: prefer earlier anchors on ties (user reads forward)
    if (overlap > bestOverlap) {
      bestOverlap = overlap
      bestIdx = i
    }
  }
  return bestIdx
}

// Harvard sentences lists 1-3 (reference text)
const harvardLists: Record<string, string[]> = {
  "list-1": [
    "The birch canoe slid on the smooth planks",
    "Glue the sheet to the dark blue background",
    "Its easy to tell the depth of a well",
    "These days a chicken leg is a rare dish",
    "Rice is often served in round bowls",
    "The juice of lemons makes fine punch",
    "The box was thrown beside the parked truck",
    "The hogs were fed chopped corn and garbage",
    "Four hours of steady work faced us",
    "A large size in stockings is hard to sell",
  ],
  "list-2": [
    "The boy was there when the sun rose",
    "A rod is used to catch pink salmon",
    "The source of the huge river is the clear spring",
    "Kick the ball straight and follow through",
    "Help the woman get back to her feet",
    "A pot of tea helps to pass the evening",
    "Smoky fires lack flame and heat",
    "The soft cushion broke the mans fall",
    "The salt breeze came across from the sea",
    "The girl at the booth sold fifty bonds",
  ],
  "list-3": [
    "The small pup gnawed a hole in the sock",
    "The fish twisted and turned on the bent hook",
    "Press the pants and sew a button on the vest",
    "The swan dive was far short of perfect",
    "The beauty of the view stunned the young boy",
    "Two blue fish swam in the tank",
    "Her purse was full of useless trash",
    "The colt reared and threw the tall rider",
    "It snowed rained and hailed the same morning",
    "Read verse out loud for pleasure",
  ],
}

// Real Deepgram Nova-2 transcriptions of OSR audio files
const deepgramResults: Record<string, string[]> = {
  // Female speaker, file OSR_us_000_0010_8k.wav
  "list-1": [
    "the birch canoe slid on the smooth planks",
    "glue the sheet to the dark blue background",
    "it is easy to tell the depth of a well",
    "these days a chicken leg is a rare dish",
    "rice is often served in round bowls",
    "the juice of lemons makes fine punch",
    "the box was thrown beside the park truck",         // "parked" → "park"
    "the hogs were fed chopped corn and garbage",
    "four hours of steady work faced us",
    "a large size in stockings is hard to sell",
  ],
  // Female speaker, file OSR_us_000_0011_8k.wav
  "list-2": [
    "the boy was there when the sun rose",
    "a rod is used to catch pink salmon",
    "the source of the huge river is the clear spring",
    "kick the ball straight and follow through",
    "helped the woman get back to her feet",            // "Help" → "helped"
    "the pot of tea helps to pass the evening",         // "A pot" → "the pot"
    "smokey fires lack flame and heat",                 // "Smoky" → "smokey"
    "the soft cushion broke the man's fall",
    "the salt breeze came across the sea",              // "from the sea" → "the sea"
    "the girl at the booth sold fifty bonds",
  ],
  // Female speaker, file OSR_us_000_0012_8k.wav
  "list-3": [
    "the small pup nod a hole in the sock",             // "gnawed" → "nod"
    "the fish twisted and turned on the bent hook",
    "press the pants and sew a button on the vest",
    "the swan dive was far short of perfect",
    "the beauty of the view stunned the young boy",
    "two blue fish swam in the tank",
    "her purse was full of useless",                     // "useless trash" → cut off
    "trash the colt reared and threw the tall rider",    // merged with previous
    "it snowed rain and hail the same morning",          // "rained and hailed" → "rain and hail"
    "read verse out loud for pleasure",
  ],
}

function main() {
  const outDir = path.join(__dirname, "test-scripts", "asr-real")
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

  // Also use list-2's Deepgram output as off-script against list-1, etc.
  const listNames = Object.keys(harvardLists)

  for (const listName of listNames) {
    const refSentences = harvardLists[listName]
    const dgUtterances = deepgramResults[listName]

    // Build script from reference
    const fullScript = refSentences.join(" ")
    const anchors = chunkScript(fullScript)

    // Map each Deepgram utterance to best anchor
    const testCases: { speech: string; expectedAnchorIndex: number; label: string }[] = []

    for (const utt of dgUtterances) {
      const bestAnchor = findBestAnchor(utt, anchors)
      testCases.push({
        speech: utt,
        expectedAnchorIndex: bestAnchor,
        label: "real-asr-deepgram",
      })
    }

    // Add off-script cases: use utterances from OTHER lists
    for (const otherList of listNames) {
      if (otherList === listName) continue
      // Pick 2 utterances from each other list as off-script
      const otherUtts = deepgramResults[otherList]
      testCases.push({
        speech: otherUtts[0],
        expectedAnchorIndex: -1,
        label: "off-script-cross-list",
      })
      testCases.push({
        speech: otherUtts[5],
        expectedAnchorIndex: -1,
        label: "off-script-cross-list",
      })
    }

    const output = {
      name: `Harvard Sentences ${listName}`,
      source: "Open Speech Repository (voiptroubleshooter.com), Deepgram Nova-2 transcription",
      anchors,
      testCases,
    }

    const outFile = path.join(outDir, `harvard-${listName}.json`)
    fs.writeFileSync(outFile, JSON.stringify(output, null, 2) + "\n")
    console.log(`${outFile}: ${anchors.length} anchors, ${testCases.length} test cases`)
  }

  console.log("\nDone. Add 'asr-real' to semantic-tuning.ts loadTestScripts().")
}

main()
