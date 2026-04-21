"use client"

import { useState, useEffect } from "react"
import { Settings } from "lucide-react"
import { motion } from "framer-motion"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import type { ApiKeys } from "@/hooks/use-api-keys"

interface SettingsDialogProps {
  keys: ApiKeys
  onSave: (keys: ApiKeys) => void
}

export function SettingsDialog({ keys, onSave }: SettingsDialogProps) {
  const [open, setOpen] = useState(false)
  const [openaiKey, setOpenaiKey] = useState(keys.openaiKey)
  const [deepgramKey, setDeepgramKey] = useState(keys.deepgramKey)

  useEffect(() => {
    if (open) {
      setOpenaiKey(keys.openaiKey)
      setDeepgramKey(keys.deepgramKey)
    }
  }, [open, keys])

  const handleSave = () => {
    onSave({ openaiKey: openaiKey.trim(), deepgramKey: deepgramKey.trim() })
    setOpen(false)
  }

  return (
    <>
      <motion.button
        onClick={() => setOpen(true)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full bg-glass backdrop-blur-sm border border-glass-border transition-colors hover:bg-glass/80"
        whileTap={{ scale: 0.95 }}
        aria-label="Settings"
      >
        <Settings className="h-4 w-4 text-foreground" />
      </motion.button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>API Keys</DialogTitle>
            <DialogDescription>
              Enter your own API keys to use the teleprompter. Keys are stored locally in your browser.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="openai-key">OpenAI API Key</Label>
              <Input
                id="openai-key"
                type="password"
                placeholder="sk-..."
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Used for embedding pipeline.{" "}
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  Get a key
                </a>
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="deepgram-key">Deepgram API Key</Label>
              <Input
                id="deepgram-key"
                type="password"
                placeholder="..."
                value={deepgramKey}
                onChange={(e) => setDeepgramKey(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Used for speech recognition. Needs Admin role.{" "}
                <a
                  href="https://console.deepgram.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  Get a key
                </a>
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
