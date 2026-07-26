import "server-only"

import { getServerAiReplyConfig } from "@/lib/ai-reply-config"
import { getAutoCategorizeConfig } from "@/lib/ai/capabilities/auto-categorize-config"
import { resolveAiProvider, type AiProviderConfig } from "@/lib/ai/provider"
import { runAiTask } from "@/lib/ai/service"

export type PostOptimizeTarget = "title" | "content"

export async function optimizePostText(params: {
  target: PostOptimizeTarget
  text: string
  title?: string
  content?: string
}) {
  const text = params.text.trim()
  if (!text) {
    throw new Error(params.target === "title" ? "请先填写标题" : "请先填写正文")
  }

  const [aiConfig, assistConfig] = await Promise.all([
    getServerAiReplyConfig(),
    getAutoCategorizeConfig(),
  ])
  const enabled = params.target === "title"
    ? assistConfig.titleOptimizeEnabled
    : assistConfig.contentOptimizeEnabled
  if (!enabled) {
    throw new Error(params.target === "title" ? "标题优化未启用" : "内容优化未启用")
  }
  if (!aiConfig.apiKey || !aiConfig.model.trim()) {
    throw new Error("AI 服务尚未配置")
  }

  const providerConfig: AiProviderConfig = {
    kind: "openai-compatible",
    baseUrl: aiConfig.baseUrl,
    apiKey: aiConfig.apiKey,
  }
  const context = params.target === "title"
    ? [params.content?.trim() ? `正文参考：\n${params.content.trim().slice(0, 4_000)}` : "", `待优化标题：\n${text}`]
    : [params.title?.trim() ? `标题参考：\n${params.title.trim().slice(0, 200)}` : "", `待优化正文：\n${text}`]

  const result = await runAiTask({
    kind: "chat",
    appKey: "app.ai-reply",
    provider: resolveAiProvider(providerConfig),
    messages: [
      {
        role: "system",
        content: params.target === "title"
          ? assistConfig.titleOptimizePrompt
          : assistConfig.contentOptimizePrompt,
      },
      { role: "user", content: context.filter(Boolean).join("\n\n") },
    ],
    options: {
      model: aiConfig.model,
      temperature: aiConfig.temperature,
      maxTokens: params.target === "title" ? 200 : Math.min(aiConfig.maxOutputTokens, 4_000),
      timeoutMs: aiConfig.timeoutMs,
    },
  })

  const optimized = result.text.trim().replace(params.target === "title" ? /^(["“])|(["”])$/g : /$^/, "")
  if (!optimized) {
    throw new Error("AI 未返回可用内容")
  }
  return params.target === "title" ? optimized.replace(/\s+/g, " ").slice(0, 200) : optimized
}
