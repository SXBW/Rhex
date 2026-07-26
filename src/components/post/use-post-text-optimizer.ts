"use client"

import { useState } from "react"

interface OptimizeResponse {
  code?: number
  message?: string
  data?: { optimized?: string }
}

export function usePostTextOptimizer() {
  const [pendingTarget, setPendingTarget] = useState<"title" | "content" | null>(null)

  async function optimize(params: {
    target: "title" | "content"
    text: string
    title?: string
    content?: string
  }) {
    setPendingTarget(params.target)
    try {
      const response = await fetch("/api/posts/ai-optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      })
      const result = await response.json().catch(() => null) as OptimizeResponse | null
      if (!response.ok || result?.code !== 0 || !result.data?.optimized) {
        throw new Error(result?.message ?? "AI 优化失败")
      }
      return result.data.optimized
    } finally {
      setPendingTarget(null)
    }
  }

  return { optimize, pendingTarget }
}
