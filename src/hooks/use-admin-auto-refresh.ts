"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef } from "react"

const DEFAULT_INTERVAL_MS = 30_000
const MIN_REFRESH_GAP_MS = 10_000

function isUserEditingText() {
  if (typeof document === "undefined") {
    return false
  }

  const element = document.activeElement
  if (!element || !(element instanceof HTMLElement)) {
    return false
  }

  if (element.isContentEditable) {
    return true
  }

  const tagName = element.tagName.toLowerCase()
  return tagName === "input" || tagName === "textarea" || tagName === "select"
}

export function useAdminAutoRefresh(options?: { intervalMs?: number }) {
  const router = useRouter()
  const intervalMs = options?.intervalMs ?? DEFAULT_INTERVAL_MS
  const lastRefreshAtRef = useRef(0)

  useEffect(() => {
    function refreshIfNeeded() {
      if (isUserEditingText()) {
        return
      }

      const now = Date.now()
      if (now - lastRefreshAtRef.current < MIN_REFRESH_GAP_MS) {
        return
      }

      lastRefreshAtRef.current = now
      router.refresh()
    }

    const timer = window.setInterval(refreshIfNeeded, intervalMs)

    function handleFocus() {
      refreshIfNeeded()
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        refreshIfNeeded()
      }
    }

    function handlePageShow() {
      refreshIfNeeded()
    }

    window.addEventListener("focus", handleFocus)
    window.addEventListener("pageshow", handlePageShow)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      window.clearInterval(timer)
      window.removeEventListener("focus", handleFocus)
      window.removeEventListener("pageshow", handlePageShow)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [intervalMs, router])

  return router
}
