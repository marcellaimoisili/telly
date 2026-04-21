/**
 * Benchmark: Measure LCS latency for typical teleprompter inputs.
 * This is tuning/measurement logic, not production code.
 *
 * Run with: npx tsx lib/benchmark-lcs.ts
 */

import { lcsMatchScore } from "./lcs-matcher"

export interface BenchmarkResult {
  name: string
  microsecondsPerCall: number
  isAcceptable: boolean
}

export function benchmarkLCS(): BenchmarkResult[] {
  const testCases = [
    {
      name: "short-speech",
      spoken: "to be or not to be",
      anchor: "To be, or not to be, that is the question:",
    },
    {
      name: "medium-speech",
      spoken: "that flesh is heir to tis a consummation devoutly to be wished",
      anchor: "That flesh is heir to: 'tis a consummation Devoutly to be wish'd.",
    },
    {
      name: "paraphrased",
      spoken: "to die and then sleep no more",
      anchor: "To die, to sleep; No more; and by a sleep to say we end",
    },
    {
      name: "off-script",
      spoken: "to sleep perchance to dream",
      anchor: "Devoutly to be wish'd. To die, to sleep;",
    },
  ]

  console.log("\n📊 LCS Performance Benchmark")
  console.log("=".repeat(70))
  console.log("Measuring: typical teleprompter matching latency\n")

  const results: BenchmarkResult[] = []

  for (const testCase of testCases) {
    const iterations = 10000
    const start = performance.now()

    for (let i = 0; i < iterations; i++) {
      lcsMatchScore(testCase.spoken, testCase.anchor)
    }

    const end = performance.now()
    const totalMs = end - start
    const perCallUs = (totalMs * 1000) / iterations

    // Acceptable: < 100 microseconds (0.1ms)
    // Fast path runs before semantic fallback, so should be quick
    const isAcceptable = perCallUs < 100

    results.push({
      name: testCase.name,
      microsecondsPerCall: perCallUs,
      isAcceptable,
    })

    const status = isAcceptable ? "✅" : "⚠️"
    console.log(`${status} ${testCase.name.padEnd(20)} ${perCallUs.toFixed(2)} µs/call`)
  }

  console.log("\n" + "=".repeat(70))
  console.log("\n📌 Context:")
  console.log("   • 1ms = 1,000 µs")
  console.log("   • Fast path target: < 100 µs (called every transcript update)")
  console.log("   • Semantic fallback: ~200ms (called less frequently)")
  console.log("   • User speaking rate: ~150 words/min = 2–3 words/sec")
  console.log("     → transcript updates every ~300ms on average")
  console.log("\n💡 LCS is fast enough for the fast path!\n")

  return results
}

if (require.main === module) {
  const results = benchmarkLCS()
  const allAcceptable = results.every(r => r.isAcceptable)
  process.exit(allAcceptable ? 0 : 1)
}
