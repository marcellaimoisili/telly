"use client"

import { useEffect, useMemo, useRef } from "react"
import { motion } from "framer-motion"

interface TeleprompterProps {
  script: string
  pointerIndex: number
  isListening: boolean
}

export function Teleprompter({ script, pointerIndex }: TeleprompterProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const lineEls = useRef<Map<number, HTMLDivElement>>(new Map())

  const lines = useMemo(() => {
    const words = script.split(/\s+/).filter(Boolean)
    const result: string[] = []
    for (let i = 0; i < words.length; i += 5) {
      result.push(words.slice(i, i + 5).join(" "))
    }
    return result
  }, [script])

  // Scroll container to pin current line at ~25% from top
  useEffect(() => {
    const el = lineEls.current.get(pointerIndex)
    const container = scrollRef.current
    if (!el || !container) return

    const containerHeight = container.clientHeight
    const lineTop = el.offsetTop
    const lineHeight = el.offsetHeight

    container.scrollTo({
      top: lineTop - containerHeight * 0.25 + lineHeight / 2,
      behavior: "smooth",
    })
  }, [pointerIndex])

  const getLineOpacity = (index: number) => {
    const diff = index - pointerIndex
    if (diff === 0) return 1
    if (diff === 1) return 0.7
    if (diff === 2) return 0.4
    if (diff > 2) return 0.2
    if (diff < 0) return 0.15
    return 0.2
  }

  const getLineScale = (index: number) => {
    return index === pointerIndex ? 1.05 : 1
  }

  return (
    <motion.div
      className="absolute inset-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Top fade gradient */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-32 bg-gradient-to-b from-background to-transparent" />

      {/* Bottom fade gradient */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-32 bg-gradient-to-t from-background to-transparent" />

      {/* Scrollable text container */}
      <div
        ref={scrollRef}
        className="h-full overflow-y-auto px-8 py-[40vh] scrollbar-hide"
      >
        <div className="mx-auto flex flex-col items-center">
          {lines.map((line, index) => (
            <motion.div
              key={index}
              ref={(el) => {
                if (el) lineEls.current.set(index, el)
              }}
              className="max-w-4xl text-center"
              animate={{
                opacity: getLineOpacity(index),
                scale: getLineScale(index),
              }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            >
              <p className="font-sans text-4xl font-medium leading-relaxed tracking-tight text-foreground md:text-5xl lg:text-6xl">
                {line}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}
