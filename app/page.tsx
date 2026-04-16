"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ScriptEditor } from "@/components/script-editor"
import { Teleprompter } from "@/components/teleprompter"
import { ModeToggle } from "@/components/mode-toggle"
import { StopButton } from "@/components/stop-button"
import { MicIndicator } from "@/components/mic-indicator"

type Mode = "editing" | "reading"

export default function Home() {
  const [mode, setMode] = useState<Mode>("editing")
  const [script, setScript] = useState("")
  const [pointerIndex, setPointerIndex] = useState(0)
  const [isListening, setIsListening] = useState(false)

  // Demo: Auto-advance pointer when in reading mode (simulates transcription matching)
  useEffect(() => {
    if (mode !== "reading") return

    // TODO: Replace this demo auto-advance with actual transcription logic
    // This interval simulates the AI matching spoken words to script
    const words = script.split(/\s+/).filter(Boolean)
    
    const interval = setInterval(() => {
      setPointerIndex((prev) => {
        if (prev >= words.length - 1) {
          // Reached end of script
          return prev
        }
        return prev + 1
      })
    }, 800) // Simulates ~75 words per minute reading speed

    return () => clearInterval(interval)
  }, [mode, script])

  const handleStartReading = useCallback(() => {
    setPointerIndex(0)
    setIsListening(true)
    setMode("reading")

    // TODO: Initialize speech recognition / transcription here
    // Example:
    // const recognition = new webkitSpeechRecognition()
    // recognition.continuous = true
    // recognition.interimResults = true
    // recognition.onresult = (event) => { /* match to script, update pointerIndex */ }
    // recognition.start()
  }, [])

  const handleStopReading = useCallback(() => {
    setMode("editing")
    setIsListening(false)
    setPointerIndex(0)

    // TODO: Stop speech recognition here
    // recognition.stop()
  }, [])

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
              <MicIndicator isListening={isListening} />
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
                isListening={isListening}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

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
