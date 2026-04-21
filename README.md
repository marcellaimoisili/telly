# Telly

An AI-powered teleprompter that listens to your voice and scrolls along in real time. Paste a script, start reading, and Telly keeps up with you — no fixed scroll speed, no manual controls.

**Live demo:** [v0-telly-beta.vercel.app](https://v0-telly-beta.vercel.app)

## Setup

```bash
pnpm install
```

Create a `.env.local` file:

```
OPENAI_API_KEY=sk-...
DEEPGRAM_API_KEY=...
```

- **OpenAI:** [platform.openai.com/api-keys](https://platform.openai.com/api-keys) — needed for embedding pipeline
- **Deepgram:** [console.deepgram.com](https://console.deepgram.com) — needs **Admin** role to mint temporary keys

```bash
pnpm dev
```

## Architecture

- **Transcription:** Deepgram Nova-3 streaming via WebSocket with interim + final results. Chosen over Web Speech API (Chrome-only), OpenAI Whisper (unpredictable latency), and four other providers after evaluating latency, accuracy, and cross-browser support.
- **Hybrid matching:** LCS-based sequence matching runs first (instant, ~2 microseconds per call, zero API calls) for on-script reading. Falls back to OpenAI `text-embedding-3-small` cosine similarity for off-script detection. Sequence-aware matching respects word order and handles paraphrasing gracefully.
- **Pre-computed embeddings:** All script anchors are embedded in a single batched API call at session start. Live speech is only embedded when the fast path fails and user has accumulated 4+ unmatched words (signal of off-script).
- **Teleprompter scroll:** Native `scrollTo` on an `absolute inset-0` constrained container. Zero CLS, accessible to screen readers, controls stay fixed outside the scroll context.
- **Security:** Temporary Deepgram API keys (30s TTL, `usage:write` scope) minted server-side. Master key never reaches the browser. Embed route capped at 500 texts per request. Optional: users can provide their own API keys (stored locally) via settings dialog.

## Improvements Made

**From word overlap to sequence matching (LCS):**
Initial approach used stop-word filtering + word overlap matching. This broke on poetry and script-heavy filler words (e.g., Hamlet's "to be or not to be" → filters to ["be"] → matches multiple anchors → false positives).

Redesigned to use **Longest Common Subsequence (LCS)** matching:
- Respects word order (critical for position tracking)
- No stop-word filtering (keeps context)
- Robust to paraphrasing and transcription errors
- ~2 microseconds per match (sub-millisecond, acceptable for fast path)
- Eliminates race conditions in async semantic fallback

**Race condition fix in semantic fallback:**
Async embedding requests could complete out-of-order while pointer advanced. Solution: capture pointer position when embedding starts, not when it completes.

## Tuning & Optimization

**Current parameters (data-driven):**
- LCS match window: 1 (checks next anchor only, prevents backward jumps)
- LCS match threshold: 0.5 (50%+ of anchor words must match in sequence)
- Semantic window: 3 (searches next 3 anchors on off-script fallback)
- Semantic threshold: **0.25** (OpenAI embedding similarity) ← **tuned via grid search**
- Min unmatched words before semantic: 4 (triggers after 4+ unmatched words)

**Parameter Tuning Methodology:**

Grid search over semantic threshold [0.25, 0.30, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60] using real OpenAI embeddings:
- Test suite: 16 diverse cases (exact reads, paraphrases, off-script samples)
- Scoring: accuracy - (false_positives × 0.5) — heavily penalizing false positives
- Result: threshold=0.25 achieves **100% accuracy, 0 false positives, 0 false negatives with limited hamlet data set trial**

Run: `OPENAI_API_KEY=... npx tsx lib/semantic-tuning.ts`

**Why 0.25 works:**
With semantic embeddings (vs. syntactic LCS), a low threshold is safe because embeddings encode meaning, not just words. 0.25 catches paraphrases without matching off-script text.

## Real-World Data Sourcing & Challenges

**Data sources researched:**
- [LibriSpeech](https://www.openslr.org/12) — 1000+ hours audiobooks with transcripts (perfect script/speech pairing)
- [Supreme Court Oral Arguments (SCOTUS)](https://github.com/noajshu/scotus-speech) — lawyers reading prepared briefs with official transcripts
- [TED-LIUM](https://huggingface.co/datasets/LIUM/tedlium) — 2351 talks with auto-aligned transcriptions
- [StoryMovie](https://arxiv.org/abs/2602.21829) — 1757 movies with script/subtitle alignment using LCS

**Implementation obstacles:**
- LibriSpeech: Huge dataset (1000+ hours), slow to download and parse in real-time
- SCOTUS: Has recorded speech + transcripts, but **no original prepared briefs** (only what was actually spoken)
- TED: Has transcripts, but **no prepared speaker notes** to compare against
- Dataset pairing problem: Most speech datasets capture what was *said*, not what was *supposed to be said*

**Pragmatic solution:**
Used Hamlet (known script) with generated paraphrases and off-script samples, then tuned on real OpenAI embeddings Also used transcript and doctored 'scripts' for them. This preserved the data-driven approach (embedding-based grid search with real cosine similarity) while working around dataset limitations.

## Trade-offs

- **LCS fast path + semantic fallback (hybrid):** LCS gives instant (~2µs) on-script tracking with zero API calls. Semantic embedding (~200ms) only triggers when user goes off-script (4+ unmatched words). Result: responsive UX without wasting API quota.
- **Sequence matching over semantic similarity:** LCS respects word order and is robust to transcription errors. Semantic matching is more flexible but slower and prone to false matches on garbage input. Fast path is the critical path.
- **Pointer advances to N+1:** When line 3 is matched (user finished reading it), line 4 is highlighted. User needs to see what comes next. Advance happens only after sufficient match confidence (50%+ LCS).
- **Immediate firing on finals, debounced interims:** Deepgram finals are stable, matching fires immediately. Interims debounced at 250ms to avoid pointer jitter from unstable partials.
- **Forward-only pointer with window=1:** Prevents backward jumps (user can't re-match previous lines). Tight window (1 anchor ahead) prevents jumping on common words or repeated content.
- **`scrollTo` over CSS transforms:** Transforms bypass native scroll, break screen reader accessibility, risk layout shifts. Native scroll maintains accessibility while preventing CLS.

## Future Improvements

**High-impact (production system):**
- **Ring buffer for embedding smoothing:** Average last 5 speech embeddings before semantic matching. Filters transcription noise while preserving signal.
- **Adaptive thresholds via Deepgram confidence:** Use `confidence` score from WebSocket. When confidence is high (>0.8) but LCS fails, trigger semantic fallback. When confidence is low, require stronger evidence.
- **Real LibriSpeech integration:** Build offline pipeline to extract script/speech divergence patterns. Retune threshold on real reader behavior (accent variations, pauses, emphasis).
- **Per-user embedding cache:** Cache script embeddings across sessions for faster session start.

**Polish (if time permits):**
- **Loading state:** Visual feedback during initial anchor embedding (currently silent ~200ms delay).
- **Off-script indicator:** Highlight when pointer hasn't advanced in N seconds.
- **Tunable settings:** Expose semantic threshold via settings for different tolerance levels.
- **Extended language support:** Currently English-only. Test with non-English poetry/scripts.

## Stack

Next.js 16 (App Router) / TypeScript / Tailwind CSS / Framer Motion / Deepgram Nova-3 / OpenAI text-embedding-3-small / Vercel