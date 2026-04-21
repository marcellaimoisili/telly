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

**Current parameters (LCS-based):**
- LCS match window: 1 (checks next anchor only, forward-only prevents jumping backward)
- LCS match threshold: 0.5 (50%+ of anchor words must match in sequence)
- Semantic window: 3 (searches next 3 anchors on off-script fallback)
- Semantic threshold: 0.4 (OpenAI embedding similarity)
- Min unmatched words before semantic: 4 (triggers fallback after 4+ unmatched words accumulate)

These parameters were tuned to balance:
- **Speed:** LCS matching completes instantly, semantic is rare
- **Robustness:** 0.5 LCS threshold tolerates Deepgram transcription errors while preventing false matches
- **User experience:** Pointer advances naturally without jumping ahead or lagging behind

## Trade-offs

- **LCS fast path + semantic fallback (hybrid):** LCS gives instant (~2µs) on-script tracking with zero API calls. Semantic embedding (~200ms) only triggers when user goes off-script (4+ unmatched words). Result: responsive UX without wasting API quota.
- **Sequence matching over semantic similarity:** LCS respects word order and is robust to transcription errors. Semantic matching is more flexible but slower and prone to false matches on garbage input. Fast path is the critical path.
- **Pointer advances to N+1:** When line 3 is matched (user finished reading it), line 4 is highlighted. User needs to see what comes next. Advance happens only after sufficient match confidence (50%+ LCS).
- **Immediate firing on finals, debounced interims:** Deepgram finals are stable, matching fires immediately. Interims debounced at 250ms to avoid pointer jitter from unstable partials.
- **Forward-only pointer with window=1:** Prevents backward jumps (user can't re-match previous lines). Tight window (1 anchor ahead) prevents jumping on common words or repeated content.
- **`scrollTo` over CSS transforms:** Transforms bypass native scroll, break screen reader accessibility, risk layout shifts. Native scroll maintains accessibility while preventing CLS.

## Future Improvements

- **Tunable semantic threshold:** Currently hardcoded at 0.4. Could expose via settings for different use cases.
- **Ring buffer for embedding smoothing:** Average last 3-5 speech embeddings before semantic matching to reduce noise from transcription errors.
- **Loading state:** Visual feedback during initial anchor embedding computation.
- **Off-script indicator:** Highlight when pointer hasn't advanced in N seconds (user is off-script but system hasn't detected it yet).
- **Per-user embedding cache:** Cache script embeddings across sessions (requires login/persistence).
- **Adaptive thresholds:** Adjust LCS/semantic thresholds based on audio quality or Deepgram confidence scores.
- **Extended language support:** Currently optimized for English. Test with other languages.

## Stack

Next.js 16 (App Router) / TypeScript / Tailwind CSS / Framer Motion / Deepgram Nova-3 / OpenAI text-embedding-3-small / Vercel