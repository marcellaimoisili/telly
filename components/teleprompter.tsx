"use client"

import { useMemo, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"

interface TeleprompterProps {
  script: string
  pointerIndex: number
  isListening: boolean
}

export function Teleprompter({ script, pointerIndex }: TeleprompterProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const currentLineRef = useRef<HTMLDivElement>(null)

  // Split script into lines with ~5 words each
  const lines = useMemo(() => {
    const words = script.split(/\s+/).filter(Boolean)
    const result: string[] = []
    
    for (let i = 0; i < words.length; i += 5) {
      result.push(words.slice(i, i + 5).join(" "))
    }
    
    return result
  }, [script])

  // Calculate which line contains the current word
  const currentLineIndex = useMemo(() => {
    return Math.floor(pointerIndex / 5)
  }, [pointerIndex])

  // Scroll to keep current line centered
  useEffect(() => {
    if (currentLineRef.current && containerRef.current) {
      const container = containerRef.current
      const line = currentLineRef.current
      const containerHeight = container.clientHeight
      const lineTop = line.offsetTop
      const lineHeight = line.clientHeight
      
      const scrollTarget = lineTop - (containerHeight / 2) + (lineHeight / 2)
      
      container.scrollTo({
        top: scrollTarget,
        behavior: "smooth"
      })
    }
  }, [currentLineIndex])

  const getLineOpacity = (index: number) => {
    const diff = index - currentLineIndex
    if (diff === 0) return 1
    if (diff === 1) return 0.7
    if (diff === 2) return 0.4
    if (diff > 2) return 0.2
    if (diff < 0) return 0.15
    return 0.2
  }

  const getLineScale = (index: number) => {
    return index === currentLineIndex ? 1.05 : 1
  }

  return (
    <motion.div
      className="relative flex h-full w-full items-center justify-center overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Top fade gradient */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-32 bg-gradient-to-b from-background to-transparent" />
      
      {/* Bottom fade gradient */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-32 bg-gradient-to-t from-background to-transparent" />

      <div
        ref={containerRef}
        className="flex h-full w-full flex-col items-center overflow-y-auto px-8 py-[40vh] scrollbar-hide"
        style={{ scrollBehavior: "smooth" }}
      >
        <AnimatePresence mode="sync">
          {lines.map((line, index) => (
            <motion.div
              key={`${index}-${line}`}
              ref={index === currentLineIndex ? currentLineRef : null}
              className="max-w-4xl text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{
                opacity: getLineOpacity(index),
                y: 0,
                scale: getLineScale(index),
              }}
              transition={{
                duration: 0.4,
                ease: "easeOut",
              }}
            >
              <p className="font-sans text-4xl font-medium leading-relaxed tracking-tight text-foreground md:text-5xl lg:text-6xl">
                {line}
              </p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
