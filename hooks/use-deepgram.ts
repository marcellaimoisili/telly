"use client"

import { useRef, useState, useCallback } from "react"

interface UseDeepgramOptions {
  onStableTranscript?: (transcript: string) => void
}

function getSupportedMimeType(): string {
  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
  ]
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) return type
  }
  return ""
}

export function useDeepgram({ onStableTranscript }: UseDeepgramOptions = {}) {
  const [transcript, setTranscript] = useState("")
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const finalizedRef = useRef("")
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const callbackRef = useRef(onStableTranscript)
  callbackRef.current = onStableTranscript

  const stop = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }

    if (recorderRef.current?.state !== "inactive") {
      recorderRef.current?.stop()
    }
    recorderRef.current = null

    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }

    setIsConnected(false)
    setTranscript("")
    finalizedRef.current = ""
  }, [])

  const start = useCallback(async () => {
    try {
      setError(null)

      // 1. Mint a short-lived API key server-side
      const res = await fetch("/api/deepgram-token")
      if (!res.ok) throw new Error("Failed to get Deepgram key")
      const { key } = await res.json()

      // 2. Microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // 3. Open WebSocket to Deepgram Nova-3
      const params = new URLSearchParams({
        model: "nova-3",
        interim_results: "true",
        punctuate: "true",
        smart_format: "true",
      })

      const ws = new WebSocket(
        `wss://api.deepgram.com/v1/listen?${params}`,
        ["token", key]
      )
      wsRef.current = ws

      ws.onopen = () => {
        setIsConnected(true)

        const mimeType = getSupportedMimeType()
        const recorder = mimeType
          ? new MediaRecorder(stream, { mimeType })
          : new MediaRecorder(stream)
        recorderRef.current = recorder

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
            ws.send(e.data)
          }
        }

        recorder.start(250) // chunk every 250ms for low latency
      }

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data)
        if (data.type !== "Results") return

        const segmentText = data.channel?.alternatives?.[0]?.transcript ?? ""

        if (data.is_final) {
          if (segmentText) {
            finalizedRef.current = finalizedRef.current
              ? `${finalizedRef.current} ${segmentText}`
              : segmentText
          }

          const full = finalizedRef.current
          setTranscript(full)

          // Finals are stable — fire matching immediately
          callbackRef.current?.(full)
        } else {
          // Show interim text immediately for responsiveness
          const full = finalizedRef.current
            ? `${finalizedRef.current} ${segmentText}`
            : segmentText
          setTranscript(full)

          // Debounce interims 150ms before triggering match
          if (debounceRef.current) clearTimeout(debounceRef.current)
          debounceRef.current = setTimeout(() => {
            callbackRef.current?.(full)
          }, 150)
        }
      }

      ws.onerror = () => {
        setError("WebSocket connection error")
        stop()
      }

      ws.onclose = () => {
        setIsConnected(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start")
      stop()
    }
  }, [stop])

  return { transcript, isConnected, error, start, stop }
}
