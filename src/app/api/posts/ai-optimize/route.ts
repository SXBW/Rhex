import { apiSuccess, createUserRouteHandler, readJsonBody, type JsonObject } from "@/lib/api-route"
import { optimizePostText, type PostOptimizeTarget } from "@/lib/ai/capabilities/post-optimize"

function normalizeText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : ""
}

export const POST = createUserRouteHandler(async ({ request }) => {
  const body = await readJsonBody(request) as JsonObject
  const target: PostOptimizeTarget = body.target === "content" ? "content" : "title"
  const text = normalizeText(body.text, target === "title" ? 200 : 30_000)
  const optimized = await optimizePostText({
    target,
    text,
    title: normalizeText(body.title, 200),
    content: normalizeText(body.content, 30_000),
  })
  return apiSuccess({ optimized })
}, {
  errorMessage: "AI 优化失败",
  logPrefix: "[api/posts/ai-optimize] unexpected error",
  unauthorizedMessage: "请先登录后再使用 AI 优化",
})
