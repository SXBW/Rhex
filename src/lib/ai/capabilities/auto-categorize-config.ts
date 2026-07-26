import "server-only"

import { getAiAppConfig, isRecord, updateAiAppConfig } from "@/lib/ai/config"
import { parsePositiveSafeInteger } from "@/lib/shared/safe-integer"

/**
 * auto-categorize 的配置挂在 `app.ai-reply` 同一条 appStateJson 记录下，
 * 以独立子 key `autoCategorize` 存放，完全不影响已有 ai-reply 字段。
 *
 * 敏感信息（apiKey / baseUrl / model）复用 ai-reply 的 provider 配置，
 * 本模块不再重复保存，避免敏感数据散落。
 */
const AI_REPLY_APP_KEY = "app.ai-reply"
const AI_REPLY_SENSITIVE_KEY = "aiReplyConfig"
const AUTO_CATEGORIZE_ENTRY_KEY = "autoCategorize"

export interface AutoCategorizeConfig {
  enabled: boolean
  /** 发布页：允许用户手动优化标题。 */
  titleOptimizeEnabled: boolean
  /** 发布页：允许用户手动优化正文。 */
  contentOptimizeEnabled: boolean
  /** 发布页创建阶段：标题/正文变化后由 AI 自动选择节点。 */
  writeBoardAutoSelectEnabled: boolean
  /** 发布页创建阶段：使用 AI 产出标签候选。 */
  writeTagAutoExtractEnabled: boolean
  /** AI 未给出可用节点时回退到该 slug。留空则不回退。 */
  defaultBoardSlug: string
  titleOptimizePrompt: string
  contentOptimizePrompt: string
  promptTemplate: string
  /** 为空则放行所有 ACTIVE 板块；否则只允许这些 slug 作为候选 */
  boardWhitelistSlugs: string[]
  /** 限制 AI 最多建议多少个 tag slug */
  maxTagCount: number
}

const AUTO_CATEGORIZE_DEFAULTS: AutoCategorizeConfig = {
  enabled: false,
  titleOptimizeEnabled: false,
  contentOptimizeEnabled: false,
  writeBoardAutoSelectEnabled: false,
  writeTagAutoExtractEnabled: false,
  defaultBoardSlug: "",
  titleOptimizePrompt: "你是论坛标题优化助手。保留原意，输出一个更准确、清晰、有吸引力但不夸张的中文标题。只输出优化后的标题，不要解释，不要添加引号。",
  contentOptimizePrompt: "你是论坛内容编辑助手。保留原意和事实，不虚构信息，优化结构、语句和可读性。直接输出优化后的正文，保留必要的 Markdown，不要解释修改过程。",
  promptTemplate: [
    "你是论坛的板块/标签分类助手。",
    "根据帖子的标题与正文，从候选板块里选出最合适的板块 slug；",
    "标签方面优先复用已有候选标签；如果候选不合适，可以生成新的标签名称（宁缺毋滥，不强制选满）。",
    "如果实在无法判断，board 字段输出空字符串。",
    "只输出 JSON，且不要附加任何解释或 markdown，形如：",
    "{\"board\":\"<slug>\",\"tags\":[\"<slug>\",...],\"reasoning\":\"<一句话理由>\"}",
  ].join("\n"),
  boardWhitelistSlugs: [],
  maxTagCount: 5,
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value
  if (typeof value === "string") {
    const v = value.trim().toLowerCase()
    if (["1", "true", "yes", "on"].includes(v)) return true
    if (["0", "false", "no", "off"].includes(v)) return false
  }
  return fallback
}

function normalizeStringList(value: unknown, maxItems: number, maxItemLen: number): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of value) {
    if (typeof raw !== "string") continue
    const t = raw.trim().slice(0, maxItemLen)
    if (!t || seen.has(t)) continue
    seen.add(t)
    out.push(t)
    if (out.length >= maxItems) break
  }
  return out
}

function normalizeRequiredString(value: unknown, fallback: string, maxLen: number): string {
  const raw = typeof value === "string" ? value : ""
  const trimmed = raw.trim().slice(0, maxLen)
  return trimmed || fallback
}

function normalizeOptionalSlug(value: unknown, maxLen: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLen) : ""
}

function normalizeAutoCategorize(entry: unknown): AutoCategorizeConfig {
  const cfg = isRecord(entry) ? entry : {}
  const parsedMaxTags = parsePositiveSafeInteger(cfg.maxTagCount)
  return {
    enabled: normalizeBoolean(cfg.enabled, AUTO_CATEGORIZE_DEFAULTS.enabled),
    titleOptimizeEnabled: normalizeBoolean(cfg.titleOptimizeEnabled, AUTO_CATEGORIZE_DEFAULTS.titleOptimizeEnabled),
    contentOptimizeEnabled: normalizeBoolean(cfg.contentOptimizeEnabled, AUTO_CATEGORIZE_DEFAULTS.contentOptimizeEnabled),
    writeBoardAutoSelectEnabled: normalizeBoolean(
      cfg.writeBoardAutoSelectEnabled,
      AUTO_CATEGORIZE_DEFAULTS.writeBoardAutoSelectEnabled,
    ),
    writeTagAutoExtractEnabled: normalizeBoolean(
      cfg.writeTagAutoExtractEnabled,
      AUTO_CATEGORIZE_DEFAULTS.writeTagAutoExtractEnabled,
    ),
    defaultBoardSlug: normalizeOptionalSlug(cfg.defaultBoardSlug, 120),
    titleOptimizePrompt: normalizeRequiredString(cfg.titleOptimizePrompt, AUTO_CATEGORIZE_DEFAULTS.titleOptimizePrompt, 4_000),
    contentOptimizePrompt: normalizeRequiredString(cfg.contentOptimizePrompt, AUTO_CATEGORIZE_DEFAULTS.contentOptimizePrompt, 4_000),
    promptTemplate: normalizeRequiredString(cfg.promptTemplate, AUTO_CATEGORIZE_DEFAULTS.promptTemplate, 4_000),
    boardWhitelistSlugs: normalizeStringList(cfg.boardWhitelistSlugs, 100, 100),
    maxTagCount: Math.min(
      20,
      Math.max(1, typeof parsedMaxTags === "number" ? parsedMaxTags : AUTO_CATEGORIZE_DEFAULTS.maxTagCount),
    ),
  }
}

export async function getAutoCategorizeConfig(): Promise<AutoCategorizeConfig> {
  const { appStateEntry } = await getAiAppConfig(AI_REPLY_APP_KEY, { sensitiveKey: AI_REPLY_SENSITIVE_KEY })
  const raw = appStateEntry && isRecord(appStateEntry[AUTO_CATEGORIZE_ENTRY_KEY])
    ? appStateEntry[AUTO_CATEGORIZE_ENTRY_KEY]
    : null
  return normalizeAutoCategorize(raw)
}

export interface UpdateAutoCategorizeInput {
  enabled?: unknown
  titleOptimizeEnabled?: unknown
  contentOptimizeEnabled?: unknown
  writeBoardAutoSelectEnabled?: unknown
  writeTagAutoExtractEnabled?: unknown
  defaultBoardSlug?: unknown
  titleOptimizePrompt?: unknown
  contentOptimizePrompt?: unknown
  promptTemplate?: unknown
  boardWhitelistSlugs?: unknown
  maxTagCount?: unknown
}

export async function updateAutoCategorizeConfig(
  input: UpdateAutoCategorizeInput,
): Promise<AutoCategorizeConfig> {
  const snap = await getAiAppConfig(AI_REPLY_APP_KEY, { sensitiveKey: AI_REPLY_SENSITIVE_KEY })
  const existingEntry: Record<string, unknown> = snap.appStateEntry ? { ...snap.appStateEntry } : {}
  const currentAuto = isRecord(existingEntry[AUTO_CATEGORIZE_ENTRY_KEY])
    ? (existingEntry[AUTO_CATEGORIZE_ENTRY_KEY] as Record<string, unknown>)
    : {}

  const merged: Record<string, unknown> = { ...currentAuto }
  if (input.enabled !== undefined) merged.enabled = input.enabled
  if (input.titleOptimizeEnabled !== undefined) merged.titleOptimizeEnabled = input.titleOptimizeEnabled
  if (input.contentOptimizeEnabled !== undefined) merged.contentOptimizeEnabled = input.contentOptimizeEnabled
  if (input.writeBoardAutoSelectEnabled !== undefined) {
    merged.writeBoardAutoSelectEnabled = input.writeBoardAutoSelectEnabled
  }
  if (input.writeTagAutoExtractEnabled !== undefined) {
    merged.writeTagAutoExtractEnabled = input.writeTagAutoExtractEnabled
  }
  if (input.defaultBoardSlug !== undefined) merged.defaultBoardSlug = input.defaultBoardSlug
  if (input.titleOptimizePrompt !== undefined) merged.titleOptimizePrompt = input.titleOptimizePrompt
  if (input.contentOptimizePrompt !== undefined) merged.contentOptimizePrompt = input.contentOptimizePrompt
  if (input.promptTemplate !== undefined) merged.promptTemplate = input.promptTemplate
  if (input.boardWhitelistSlugs !== undefined) merged.boardWhitelistSlugs = input.boardWhitelistSlugs
  if (input.maxTagCount !== undefined) merged.maxTagCount = input.maxTagCount

  const normalized = normalizeAutoCategorize(merged)
  existingEntry[AUTO_CATEGORIZE_ENTRY_KEY] = {
    enabled: normalized.enabled,
    titleOptimizeEnabled: normalized.titleOptimizeEnabled,
    contentOptimizeEnabled: normalized.contentOptimizeEnabled,
    writeBoardAutoSelectEnabled: normalized.writeBoardAutoSelectEnabled,
    writeTagAutoExtractEnabled: normalized.writeTagAutoExtractEnabled,
    defaultBoardSlug: normalized.defaultBoardSlug,
    titleOptimizePrompt: normalized.titleOptimizePrompt,
    contentOptimizePrompt: normalized.contentOptimizePrompt,
    promptTemplate: normalized.promptTemplate,
    boardWhitelistSlugs: normalized.boardWhitelistSlugs,
    maxTagCount: normalized.maxTagCount,
  }

  await updateAiAppConfig(AI_REPLY_APP_KEY, {
    record: snap.record,
    sensitiveKey: AI_REPLY_SENSITIVE_KEY,
    appStateEntry: existingEntry,
  })
  return normalized
}

export { AUTO_CATEGORIZE_DEFAULTS }
