"use client"

import { Square } from "lucide-react"
import { motion } from "framer-motion"

interface StopButtonProps {
  onStop: () => void
}

export function StopButton({ onStop }: StopButtonProps) {
  return (
    <motion.button
      onClick={onStop}
      className="flex items-center gap-2 rounded-full bg-glass backdrop-blur-md border border-glass-border px-5 py-3 text-sm font-medium text-foreground shadow-lg transition-all hover:bg-glass/80 hover:shadow-xl"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <Square className="h-3.5 w-3.5 fill-current" />
      <span>Stop</span>
    </motion.button>
  )
}
