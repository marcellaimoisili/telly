/**
 * Grid search: find optimal parameters by testing all combinations.
 * Run with: npx tsx lib/tune-params.ts
 */

import { testCases } from "./test-cases"
import { evaluateParamsOnTestSuite, type EvalParams } from "./evaluate"

const PARAM_RANGES = {
  localWindow: [1, 2, 3, 4],
  localThreshold: [0.3, 0.4, 0.5, 0.6, 0.7],
  semanticWindow: [3, 5, 8],
  semanticThreshold: [0.4, 0.5, 0.6],
  minUnmatchedWords: [4, 6, 8, 10],
}

interface BestResult {
  params: EvalParams
  accuracy: number
  deviation: number
  testsPassed: number
}

async function tuneParameters(): Promise<BestResult> {
  let best: BestResult = {
    params: {
      localWindow: 2,
      localThreshold: 0.5,
      semanticWindow: 5,
      semanticThreshold: 0.5,
      minUnmatchedWords: 8,
    },
    accuracy: 0,
    deviation: Infinity,
    testsPassed: 0,
  }

  let totalCombinations = 0
  let testedCombinations = 0

  // Count total combinations
  totalCombinations =
    PARAM_RANGES.localWindow.length *
    PARAM_RANGES.localThreshold.length *
    PARAM_RANGES.semanticWindow.length *
    PARAM_RANGES.semanticThreshold.length *
    PARAM_RANGES.minUnmatchedWords.length

  console.log(`Testing ${totalCombinations} parameter combinations against ${testCases.length} test cases...`)
  console.log()

  // Grid search
  for (const lw of PARAM_RANGES.localWindow) {
    for (const lt of PARAM_RANGES.localThreshold) {
      for (const sw of PARAM_RANGES.semanticWindow) {
        for (const st of PARAM_RANGES.semanticThreshold) {
          for (const muw of PARAM_RANGES.minUnmatchedWords) {
            testedCombinations++

            const params: EvalParams = {
              localWindow: lw,
              localThreshold: lt,
              semanticWindow: sw,
              semanticThreshold: st,
              minUnmatchedWords: muw,
            }

            const result = evaluateParamsOnTestSuite(testCases, params)

            // Prefer higher accuracy, then lower deviation
            const score = result.avgAccuracy - result.avgDeviation * 0.1
            const bestScore = best.accuracy - best.deviation * 0.1

            if (score > bestScore) {
              best = {
                params,
                accuracy: result.avgAccuracy,
                deviation: result.avgDeviation,
                testsPassed: result.totalCorrect,
              }
            }

            // Progress indicator
            if (testedCombinations % 50 === 0) {
              const progress = ((testedCombinations / totalCombinations) * 100).toFixed(1)
              console.log(`Progress: ${progress}% | Current best: ${(best.accuracy * 100).toFixed(1)}% accuracy`)
            }
          }
        }
      }
    }
  }

  return best
}

async function main() {
  console.log("🔧 Telly Parameter Tuning")
  console.log("=".repeat(50))
  console.log()

  const result = await tuneParameters()

  console.log()
  console.log("=".repeat(50))
  console.log("✅ TUNING COMPLETE")
  console.log("=".repeat(50))
  console.log()
  console.log(`Accuracy: ${(result.accuracy * 100).toFixed(1)}%`)
  console.log(`Tests Passed: ${result.testsPassed}/${testCases.length}`)
  console.log(`Avg Pointer Deviation: ${result.deviation.toFixed(2)} anchors`)
  console.log()
  console.log("Optimal Parameters:")
  console.log(`  localWindow: ${result.params.localWindow}`)
  console.log(`  localThreshold: ${result.params.localThreshold}`)
  console.log(`  semanticWindow: ${result.params.semanticWindow}`)
  console.log(`  semanticThreshold: ${result.params.semanticThreshold}`)
  console.log(`  minUnmatchedWords: ${result.params.minUnmatchedWords}`)
  console.log()
  console.log("📝 Copy these values into:")
  console.log("   - lib/similarity.ts (threshold parameters)")
  console.log("   - app/page.tsx (function calls)")
}

main().catch(console.error)
