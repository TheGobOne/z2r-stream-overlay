"use client"

import { useEffect, useRef } from "react"
import { joinTracker, normalizeCode, type TrackerClient } from "@/lib/tracker-link"
import type { StartingData } from "@/lib/starting-screen"

const FIRST_RETRY_MS = 3000
const MAX_RETRY_MS = 30_000

/**
 * Keeps the starting screen in step with the overlay: joins the overlay's share code (like a remote tracker, but
 * only to receive the starting text) and rejoins by itself whenever the link drops or the overlay isn't sharing yet.
 * With no code nothing happens and the page keeps whatever text it was given.
 */
export function useStartingLink(rawCode: string | null, onData: (data: StartingData) => void) {
  const onDataRef = useRef(onData)
  onDataRef.current = onData

  useEffect(() => {
    const code = normalizeCode(rawCode ?? "")
    if (!code) return
    let cancelled = false
    let client: TrackerClient | null = null
    let timer: number | undefined
    let delay = FIRST_RETRY_MS

    const retry = () => {
      if (cancelled) return
      timer = window.setTimeout(connect, delay)
      delay = Math.min(delay * 2, MAX_RETRY_MS)
    }
    const connect = async () => {
      try {
        const joined = await joinTracker(
          code,
          (snapshot) => {
            delay = FIRST_RETRY_MS
            if (snapshot.starting) onDataRef.current(snapshot.starting)
          },
          () => {
            client = null
            retry()
          },
        )
        if (cancelled) joined.stop()
        else client = joined
      } catch {
        retry()
      }
    }
    // Deferred so a dev-mode double mount cancels before it opens a connection
    timer = window.setTimeout(connect, 0)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
      client?.stop()
    }
  }, [rawCode])
}
