"use client"

import { useState, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ScriptEditor } from "@/components/script-editor"
import { Teleprompter } from "@/components/teleprompter"
import { ModeToggle } from "@/components/mode-toggle"
import { StopButton } from "@/components/stop-button"
import { MicIndicator } from "@/components/mic-indicator"
import { useDeepgram } from "@/hooks/use-deepgram"
import { chunkScript } from "@/lib/chunk"
import { findBestMatch } from "@/lib/similarity"

type Mode = "editing" | "reading"

export default function Home() {
  const [mode, setMode] = useState<Mode>("editing")
  const [script, setScript] = useState("")
  const [pointerIndex, setPointerIndex] = useState(0)

  const pointerRef = useRef(0)
  const anchorEmbeddingsRef = useRef<number[][]>([])
  const lastEmbeddedWordCountRef = useRef(0)

  const handleStableTranscript = useCallback(async (text: string) => {
    const words = text.split(/\s+/).filter(Boolean)

    // Only re-embed if >=2 new words since last embed call
    if (words.length - lastEmbeddedWordCountRef.current < 2) return
    lastEmbeddedWordCountRef.current = words.length

    // Embed only the last ~10 words of speech
    const recentWords = words.slice(-10).join(" ")
    const res = await fetch("/api/embed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts: [recentWords] }),
    })
    const { embeddings } = await res.json()

    // Sliding-window match against the next ~5 anchors
    const match = findBestMatch(
      embeddings[0],
      anchorEmbeddingsRef.current,
      pointerRef.current,
      5,
      0.6
    )

    // Only advance forward, never backward
    if (match.index !== -1 && match.index >= pointerRef.current) {
      pointerRef.current = match.index
      setPointerIndex(match.index)
    }
  }, [])

  const { transcript, isConnected, error, start, stop } = useDeepgram({
    onStableTranscript: handleStableTranscript,
  })

  const handleStartReading = useCallback(async () => {
    // 1. Chunk the script into ~5-word anchors
    const chunks = chunkScript(script)

    // 2. Embed all anchors in one batched call
    const res = await fetch("/api/embed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts: chunks }),
    })
    const { embeddings } = await res.json()
    anchorEmbeddingsRef.current = embeddings

    // 3. Reset pointer and switch to reading mode
    pointerRef.current = 0
    setPointerIndex(0)
    lastEmbeddedWordCountRef.current = 0
    setMode("reading")

    // 4. Start streaming transcription
    await start()
  }, [script, start])

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
        <div className="ml-auto">
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
              className="flex h-full w-full items-center justify-center"
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
