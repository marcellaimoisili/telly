"use client"

import { useState, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ScriptEditor } from "@/components/script-editor"
import { Teleprompter } from "@/components/teleprompter"
import { ModeToggle } from "@/components/mode-toggle"
import { SettingsDialog } from "@/components/settings-dialog"
import { StopButton } from "@/components/stop-button"
import { MicIndicator } from "@/components/mic-indicator"
import { useDeepgram } from "@/hooks/use-deepgram"
import { useApiKeys } from "@/hooks/use-api-keys"
import { chunkScript } from "@/lib/chunk"
import { findBestMatch } from "@/lib/similarity"
import { lcsLocalMatch } from "@/lib/lcs-matcher"

type Mode = "editing" | "reading"

export default function Home() {
  const { keys, saveKeys } = useApiKeys()
  const [mode, setMode] = useState<Mode>("editing")
  const [script, setScript] = useState("")
  const [pointerIndex, setPointerIndex] = useState(0)

  const pointerRef = useRef(0)
  const anchorsRef = useRef<string[]>([])
  const anchorEmbeddingsRef = useRef<number[][]>([])
  const consumedRef = useRef(0) // words consumed by successful matches

  const advancePointer = useCallback((toIndex: number) => {
    // Advance pointer: when line N matches confidently, show line N+1 next
    // User has mostly finished line N, needs to see what comes next
    const next = Math.min(toIndex + 1, anchorsRef.current.length - 1)
    if (next > pointerRef.current) {
      pointerRef.current = next
      setPointerIndex(next)
    }
  }, [])

  const handleStableTranscript = useCallback(async (text: string) => {
    const words = text.split(/\s+/).filter(Boolean)

    // Only consider words spoken SINCE the last successful match
    const newWords = words.slice(consumedRef.current)
    if (newWords.length < 2) return

    const newSpeech = newWords.join(" ")

    // Fast path: LCS-based matching against the next 1 anchor (sequence-aware, no stop-word issues)
    // Threshold 0.5 = match when 50%+ of anchor words found in sequence (tolerates some garbage from Deepgram)
    const local = lcsLocalMatch(
      newSpeech,
      anchorsRef.current,
      pointerRef.current,
      1,
      0.5
    )

    if (local !== -1) {
      consumedRef.current = words.length // consume matched words
      advancePointer(local)
      return
    }

    // Slow path: only after enough unmatched words accumulate (user is off-script) (tuned to 4)
    if (newWords.length < 4) {
      return
    }

    // CRITICAL: Capture pointer NOW, before async embedding
    // If pointer advances while embedding is in flight, we want to use the old value
    const semanticWindowStart = pointerRef.current

    const res = await fetch("/api/embed", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(keys.openaiKey && { "x-openai-key": keys.openaiKey }),
      },
      body: JSON.stringify({ texts: [newSpeech] }),
    })
    const { embeddings } = await res.json()

    const match = findBestMatch(
      embeddings[0],
      anchorEmbeddingsRef.current,
      semanticWindowStart,
      3,
      0.4
    )

    if (match.index !== -1) {
      consumedRef.current = words.length
      advancePointer(match.index)
    }
  }, [advancePointer, keys.openaiKey])

  const { transcript, isConnected, error, start, stop } = useDeepgram({
    onStableTranscript: handleStableTranscript,
    deepgramKey: keys.deepgramKey,
  })

  const handleStartReading = useCallback(async () => {
    // 1. Chunk the script into ~5-word anchors
    const chunks = chunkScript(script)
    anchorsRef.current = chunks

    // 2. Embed all anchors in one batched call
    const res = await fetch("/api/embed", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(keys.openaiKey && { "x-openai-key": keys.openaiKey }),
      },
      body: JSON.stringify({ texts: chunks }),
    })
    const { embeddings } = await res.json()
    anchorEmbeddingsRef.current = embeddings

    // 3. Reset pointer and switch to reading mode
    pointerRef.current = 0
    setPointerIndex(0)
    consumedRef.current = 0
    setMode("reading")

    // 4. Start streaming transcription
    await start()
  }, [script, start, keys.openaiKey])

  const handleStopReading = useCallback(() => {
    stop()
    setMode("editing")
    pointerRef.current = 0
    setPointerIndex(0)
  }, [stop])

  return (
    <main className="relative flex h-dvh w-full flex-col overflow-hidden bg-background">
      {/* Header */}
      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between p-4 md:p-6">
        <AnimatePresence mode="wait">
          {mode === "reading" && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
            >
              <MicIndicator isListening={isConnected} />
            </motion.div>
          )}
        </AnimatePresence>
        <div className="ml-auto flex items-center gap-2">
          <SettingsDialog keys={keys} onSave={saveKeys} />
          <ModeToggle />
        </div>
      </header>

      {/* Main content with mode transitions */}
      <div className="relative flex flex-1 items-center justify-center">
        <AnimatePresence mode="wait">
          {mode === "editing" ? (
            <motion.div
              key="editor"
              className="flex w-full items-center justify-center"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05, filter: "blur(10px)" }}
              transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <ScriptEditor
                script={script}
                onScriptChange={setScript}
                onStartReading={handleStartReading}
              />
            </motion.div>
          ) : (
            <motion.div
              key="teleprompter"
              className="relative h-full w-full"
              initial={{ opacity: 0, scale: 1.05, filter: "blur(10px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <Teleprompter
                script={script}
                pointerIndex={pointerIndex}
                isListening={isConnected}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Debug transcript + error (bottom-left) */}
      {mode === "reading" && (transcript || error) && (
        <div className="absolute bottom-20 left-4 z-20 max-w-sm">
          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}
          {transcript && (
            <p className="text-xs text-muted-foreground/50 line-clamp-2">
              {transcript}
            </p>
          )}
        </div>
      )}

      {/* Floating stop button */}
      <AnimatePresence>
        {mode === "reading" && (
          <motion.div
            className="absolute bottom-8 left-1/2 z-20 -translate-x-1/2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ delay: 0.2 }}
          >
            <StopButton onStop={handleStopReading} />
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}
