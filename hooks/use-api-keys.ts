"use client"

import { useState, useEffect, useCallback } from "react"

const STORAGE_KEY_OPENAI = "telly-openai-key"
const STORAGE_KEY_DEEPGRAM = "telly-deepgram-key"

export interface ApiKeys {
  openaiKey: string
  deepgramKey: string
}

export function useApiKeys() {
  const [keys, setKeys] = useState<ApiKeys>({ openaiKey: "", deepgramKey: "" })
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setKeys({
      openaiKey: localStorage.getItem(STORAGE_KEY_OPENAI) ?? "",
      deepgramKey: localStorage.getItem(STORAGE_KEY_DEEPGRAM) ?? "",
    })
    setLoaded(true)
  }, [])

  const saveKeys = useCallback((newKeys: ApiKeys) => {
    if (newKeys.openaiKey) {
      localStorage.setItem(STORAGE_KEY_OPENAI, newKeys.openaiKey)
    } else {
      localStorage.removeItem(STORAGE_KEY_OPENAI)
    }
    if (newKeys.deepgramKey) {
      localStorage.setItem(STORAGE_KEY_DEEPGRAM, newKeys.deepgramKey)
    } else {
      localStorage.removeItem(STORAGE_KEY_DEEPGRAM)
    }
    setKeys(newKeys)
  }, [])

  const hasKeys = Boolean(keys.openaiKey && keys.deepgramKey)

  return { keys, saveKeys, hasKeys, loaded }
}
