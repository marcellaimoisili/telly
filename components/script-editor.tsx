"use client"

import { motion } from "framer-motion"

interface ScriptEditorProps {
  script: string
  onScriptChange: (script: string) => void
  onStartReading: () => void
}

export function ScriptEditor({ script, onScriptChange, onStartReading }: ScriptEditorProps) {
  const wordCount = script.trim() ? script.trim().split(/\s+/).length : 0
  const charCount = script.length

  return (
    <motion.div
      className="flex w-full max-w-[600px] flex-col items-center px-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <motion.p
        className="mb-8 text-center text-lg text-muted-foreground"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        {"Paste your script. Read it naturally. We'll keep up."}
      </motion.p>

      <motion.div
        className="relative w-full rounded-2xl bg-glass backdrop-blur-xl border border-glass-border shadow-xl shadow-black/5"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <div className="p-6">
          <label htmlFor="script-input" className="mb-3 block text-sm font-medium text-foreground">
            Your Script
          </label>
          <textarea
            id="script-input"
            value={script}
            onChange={(e) => onScriptChange(e.target.value)}
            placeholder="Start typing or paste your script here..."
            className="min-h-[280px] w-full resize-none bg-transparent text-foreground placeholder:text-muted-foreground/60 focus:outline-none text-base leading-relaxed"
            autoFocus
          />
          <div className="flex items-center justify-end gap-3 text-xs text-muted-foreground">
            <span>{wordCount} words</span>
            <span className="text-border">|</span>
            <span>{charCount} characters</span>
          </div>
        </div>

        <div className="border-t border-glass-border p-4">
          <motion.button
            onClick={onStartReading}
            disabled={!script.trim()}
            className="w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:shadow-primary/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
            whileHover={{ scale: script.trim() ? 1.01 : 1 }}
            whileTap={{ scale: script.trim() ? 0.99 : 1 }}
          >
            Read Back Script
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  )
}
