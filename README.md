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
- **Hybrid matching:** Local word-overlap check runs first (instant, zero API calls) for on-script reading. Falls back to OpenAI `text-embedding-3-small` cosine similarity for off-script detection. Stop words are filtered to prevent false matches on common words.
- **Pre-computed embeddings:** All script anchors are embedded in a single batched API call at session start. Live speech is only embedded when the local matcher fails.
- **Teleprompter scroll:** Native `scrollTo` on an `absolute inset-0` constrained container. Zero CLS, accessible to screen readers, controls stay fixed outside the scroll context.
- **Security:** Temporary Deepgram API keys (30s TTL, `usage:write` scope) minted server-side. Master key never reaches the browser. Embed route capped at 500 texts per request.

## Trade-offs

- **Hybrid over pure-semantic matching:** Semantic embedding adds ~200ms per match. For a teleprompter where the user reads what's on screen, local word overlap gives the same answer instantly 90%+ of the time. Embeddings are the fallback, not the critical path.
- **Pointer advances to N+1:** When line 3 is matched, line 4 is highlighted. The user already read line 3 — they need to see what's next.
- **Immediate firing on finals, debounced interims:** Deepgram finals are stable, so matching fires immediately. Interims are debounced at 250ms to avoid jitter from unstable partials.
- **Window of 3 for local, 8 for semantic:** Tight local window prevents jumping ahead on common words. Wider semantic window catches off-script jumps.
- **`scrollTo` over CSS transforms:** Transforms bypass native scroll, breaks screen reader accessibility, and risk layout shifts. The initial scroll issue was a flex `min-height: auto` bug.

## What I'd do next

- Tunable cosine similarity threshold (currently static at 0.6)
- Ring buffer of last 3-5 speech embeddings for smoothing noisy partials
- Loading state during initial embedding computation
- Off-script indicator when the user drifts from the text
- Per-user embedding cache for repeated sessions
- Background noise robustness testing

## Stack

Next.js 16 (App Router) / TypeScript / Tailwind CSS / Framer Motion / Deepgram Nova-3 / OpenAI text-embedding-3-small / Vercel
