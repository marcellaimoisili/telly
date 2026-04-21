/**
 * Real-world test cases: script → actual transcript.
 * Covers: perfect reads, paraphrasing, ad-libs, hesitations, skips, off-script.
 */

export interface TestCase {
  name: string
  script: string
  transcript: string
  description: string
}

export const testCases: TestCase[] = [
  {
    name: "perfect-read-short",
    script: "Ladies and gentlemen welcome to the conference today",
    transcript: "ladies and gentlemen welcome to the conference today",
    description: "User reads script exactly, word-for-word",
  },
  {
    name: "perfect-read-medium",
    script: "We are excited to announce a new product that will change how you think about productivity",
    transcript:
      "we are excited to announce a new product that will change how you think about productivity",
    description: "Longer perfect read",
  },
  {
    name: "hesitation-filler",
    script: "The future of artificial intelligence is bright and full of possibilities",
    transcript:
      "the future of um artificial intelligence is like really bright and full of possibilities",
    description: "User adds filler words (um, like)",
  },
  {
    name: "paraphrase-similar",
    script: "Innovation drives growth in our industry",
    transcript:
      "innovation really drives growth within our industry",
    description: "User uses slightly different wording but same meaning",
  },
  {
    name: "skip-words",
    script: "We celebrate the achievements of our incredible team today",
    transcript: "we celebrate the achievements of our team",
    description: "User skips some words (incredible, today)",
  },
  {
    name: "early-stop",
    script: "This technology represents a paradigm shift in how we approach problems",
    transcript: "this technology represents a paradigm shift",
    description: "User stops mid-script",
  },
  {
    name: "ad-lib-expansion",
    script: "The market is growing rapidly",
    transcript: "the market is actually growing quite rapidly right now in 2026",
    description: "User adds context and elaboration",
  },
  {
    name: "mixed-paraphrase",
    script: "Companies are investing heavily in cloud infrastructure",
    transcript:
      "companies are making significant investments in cloud infrastructure today",
    description: "Mix of word substitution and additions",
  },
  {
    name: "off-script-jump",
    script: "First we will discuss strategy. Then we will explore implementation details. Finally we will review results.",
    transcript: "first we will discuss strategy. finally we will review the results.",
    description: "User skips middle section entirely",
  },
  {
    name: "stutter-restart",
    script: "The solution provides real-time insights and actionable data",
    transcript:
      "the solution provides real-time insights and um real-time insights and actionable data",
    description: "User stutters and restarts",
  },
  {
    name: "low-confidence-ad-lib",
    script: "Our research shows promising results",
    transcript:
      "our research shows um promising results i think",
    description: "Hesitation + weak ad-lib",
  },
  {
    name: "multiple-pauses",
    script: "Success requires dedication perseverance and teamwork",
    transcript:
      "success requires um dedication and uh perseverance and teamwork",
    description: "Multiple filler words throughout",
  },
  {
    name: "emphasis-repetition",
    script: "This is a critical moment for our organization",
    transcript:
      "this is a critical moment a really critical moment for our organization",
    description: "User emphasizes by repeating",
  },
  {
    name: "synonym-swap",
    script: "We are committed to delivering excellence",
    transcript: "we are devoted to delivering excellence",
    description: "User swaps synonym (devoted for committed)",
  },
  {
    name: "contraction-expansion",
    script: "We'll continue to innovate and grow",
    transcript: "we will continue to innovate and grow",
    description: "User expands contraction",
  },
  {
    name: "proper-noun-casualization",
    script: "According to McKinsey research trends show acceleration",
    transcript: "according to mckinsey research trends show acceleration",
    description: "Capitalization variation (shouldn't matter after lowercasing)",
  },
  {
    name: "long-perfect-read",
    script:
      "The digital transformation landscape is evolving rapidly with new technologies emerging every quarter creating both opportunities and challenges for enterprises of all sizes",
    transcript:
      "the digital transformation landscape is evolving rapidly with new technologies emerging every quarter creating both opportunities and challenges for enterprises of all sizes",
    description: "Longer perfect read",
  },
  {
    name: "heavy-ad-lib",
    script: "Our platform is secure",
    transcript:
      "our platform is extremely secure we have bank-level encryption and pass all compliance audits",
    description: "User significantly expands on script",
  },
  {
    name: "mid-section-skip",
    script: "Step one: understand the problem. Step two: brainstorm solutions. Step three: evaluate options. Step four: implement.",
    transcript:
      "step one understand the problem step three evaluate options step four implement",
    description: "User skips step two entirely",
  },
  {
    name: "natural-speech-rhythm",
    script: "Building great products requires attention to detail",
    transcript:
      "building great products you know requires real attention to detail",
    description: "User adds conversational filler",
  },
]
