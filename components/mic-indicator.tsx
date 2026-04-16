"use client"

import { Mic } from "lucide-react"
import { motion } from "framer-motion"

interface MicIndicatorProps {
  isListening: boolean
}

export function MicIndicator({ isListening }: MicIndicatorProps) {
  if (!isListening) return null

  return (
    <motion.div
      className="flex items-center gap-2 rounded-full bg-glass backdrop-blur-md border border-glass-border px-3 py-2"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
    >
      <motion.div
        className="relative flex h-5 w-5 items-center justify-center"
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <motion.div
          className="absolute inset-0 rounded-full bg-primary/30"
          animate={{ scale: [1, 1.8, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        />
        <Mic className="h-4 w-4 text-primary" />
      </motion.div>
      <span className="text-xs font-medium text-muted-foreground">Listening</span>
    </motion.div>
  )
}
