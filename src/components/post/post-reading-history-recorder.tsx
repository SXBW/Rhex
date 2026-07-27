"use client"

import { useEffect } from "react"

import { recordReadingHistory } from "@/lib/local-reading-history"

const POST_VIEW_DEDUPLICATION_WINDOW_MS = 30 * 60 * 1_000

interface PostReadingHistoryRecorderProps {
  postId: string
  postSlug: string
  postPath: string
  title: string
  boardName?: string | null
  boardSlug?: string | null
  postCreatedAt?: string | null
}

export function PostReadingHistoryRecorder({
  postId,
  postSlug,
  postPath,
  title,
  boardName,
  boardSlug,
  postCreatedAt,
}: PostReadingHistoryRecorderProps) {
  useEffect(() => {
    recordReadingHistory({
      postId,
      postSlug,
      postPath,
      title,
      boardName,
      boardSlug,
      postCreatedAt,
    })

    const storageKey = `rhex:post-view:${postId}`
    const now = Date.now()
    let lastRecordedAt = 0

    try {
      lastRecordedAt = Number(window.sessionStorage.getItem(storageKey) ?? "0")
    } catch {
      // Storage can be unavailable in hardened browser contexts.
    }

    if (Number.isFinite(lastRecordedAt) && now - lastRecordedAt < POST_VIEW_DEDUPLICATION_WINDOW_MS) {
      return
    }

    try {
      window.sessionStorage.setItem(storageKey, String(now))
    } catch {
      // The request can still proceed when storage is unavailable.
    }

    void fetch(`/api/posts/${encodeURIComponent(postId)}/view`, {
      method: "POST",
      cache: "no-store",
      keepalive: true,
    }).catch(() => {
      try {
        window.sessionStorage.removeItem(storageKey)
      } catch {
        // Ignore storage cleanup failures.
      }
    })
  }, [boardName, boardSlug, postCreatedAt, postId, postPath, postSlug, title])

  return null
}
