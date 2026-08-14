import { escapeHtml } from "@/lib/markdown/shared"

export interface ExternalLinkCardRenderOptions {
  enabled?: boolean
  blockedDomains?: readonly string[]
  internalHosts?: readonly string[]
}

const STANDALONE_URL_PATTERN = /^https?:\/\/\S+$/i

function trimTrailingUrlPunctuation(value: string) {
  return value.replace(/[),.;:!?，。；：！？、\]}]+$/u, "")
}

function normalizeDomain(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split("/")[0]?.split(":")[0] ?? ""
}

function isValidDomain(value: string) {
  return Boolean(value)
    && value.includes(".")
    && /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(value)
}

export function normalizeLinkCardBlockedDomains(value: unknown): string[] {
  const rawItems = typeof value === "string"
    ? value.split(/[\n\r,，、\s]+/)
    : Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : []

  return Array.from(new Set(
    rawItems
      .map((item) => normalizeDomain(item))
      .filter(isValidDomain),
  ))
}

export function isHostnameBlocked(hostname: string, blockedDomains: readonly string[]) {
  const normalizedHost = normalizeDomain(hostname)
  if (!normalizedHost) {
    return false
  }

  const candidates = Array.from(new Set([normalizedHost, hostname.trim().toLowerCase()]))

  return blockedDomains.some((domain) => {
    const normalizedDomain = normalizeDomain(domain)
    if (!normalizedDomain) {
      return false
    }

    return candidates.some((candidate) => (
      candidate === normalizedDomain
      || candidate.endsWith(`.${normalizedDomain}`)
    ))
  })
}

const MARKDOWN_INLINE_LINK_URL_PATTERN = /\]\(\s*(https?:\/\/[^\s<>"')]+)/gi
const MARKDOWN_RAW_URL_PATTERN = /https?:\/\/[^\s<>"')\]]+/gi

export function hasBlockedExternalLinkInMarkdown(
  markdown: string,
  blockedDomains: readonly string[],
): boolean {
  if (!markdown || blockedDomains.length === 0) {
    return false
  }

  const candidates: string[] = []
  let inFence = false

  for (const line of markdown.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence
      continue
    }

    if (inFence) {
      continue
    }

    const codeFreeLine = line.replace(/`[^`]*`/g, "")

    for (const match of codeFreeLine.matchAll(MARKDOWN_INLINE_LINK_URL_PATTERN)) {
      const raw = match[1]?.trim()
      if (raw) {
        candidates.push(trimTrailingUrlPunctuation(raw))
      }
    }

    for (const match of codeFreeLine.matchAll(MARKDOWN_RAW_URL_PATTERN)) {
      candidates.push(trimTrailingUrlPunctuation(match[0]))
    }
  }

  const normalizedBlocked = normalizeLinkCardBlockedDomains(blockedDomains)

  for (const candidate of candidates) {
    let url: URL
    try {
      url = new URL(candidate)
    } catch {
      continue
    }

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      continue
    }

    if (isHostnameBlocked(url.hostname, normalizedBlocked)) {
      return true
    }
  }

  return false
}

function parseStandaloneExternalUrl(line: string): URL | null {
  const trimmed = line.trim()
  if (!STANDALONE_URL_PATTERN.test(trimmed)) {
    return null
  }

  const candidate = trimTrailingUrlPunctuation(trimmed)
  if (!STANDALONE_URL_PATTERN.test(candidate)) {
    return null
  }

  try {
    const url = new URL(candidate)
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null
    }

    return url
  } catch {
    return null
  }
}

function isLikelyInternalPostUrl(url: URL) {
  const pathname = url.pathname.length > 1 ? url.pathname.replace(/\/+$/g, "") : url.pathname
  return /^\/posts\/[^/]+$/.test(pathname)
}

function isInternalSiteHost(url: URL, internalHosts: readonly string[]) {
  if (internalHosts.length === 0) {
    return false
  }

  const hostname = url.hostname.toLowerCase()
  return internalHosts.some((host) => host.trim().toLowerCase() === hostname)
}

export function renderExternalLinkCardHtml(
  line: string,
  options: ExternalLinkCardRenderOptions = {},
): string | null {
  if (options.enabled === false) {
    return null
  }

  const url = parseStandaloneExternalUrl(line)
  if (!url) {
    return null
  }

  if (isLikelyInternalPostUrl(url) || isInternalSiteHost(url, options.internalHosts ?? [])) {
    return null
  }

  const blockedDomains = normalizeLinkCardBlockedDomains(options.blockedDomains)
  const blocked = isHostnameBlocked(url.hostname, blockedDomains)
  const href = escapeHtml(url.href)
  const displayHost = escapeHtml(url.host)
  const displayUrl = escapeHtml(url.href)

  if (blocked) {
    return [
      '<div class="md-link-card md-link-card-blocked my-4 overflow-hidden rounded-xl border border-rose-300 bg-rose-50/60 shadow-xs dark:border-rose-500/30 dark:bg-rose-500/10">',
      `<a\nclass="md-link-card-link block no-underline" href="${href}" target="_blank" rel="noreferrer nofollow ugc" data-md-link-card-blocked="true">`,
      '<div class="flex flex-col gap-2 p-4">',
      '<div class="flex items-center gap-2">',
      '<span class="md-link-card-badge inline-flex shrink-0 items-center rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-600 dark:bg-rose-500/15 dark:text-rose-300">风险外链</span>',
      `<span class="truncate font-semibold text-rose-700 dark:text-rose-300">${displayHost}</span>`,
      "</div>",
      `<span class="break-all text-xs text-muted-foreground">${displayUrl}</span>`,
      '<p class="text-xs leading-6 text-rose-600/90 dark:text-rose-300/90">该域名已被管理员列入风险黑名单。请勿输入账号密码或支付信息，谨慎访问。</p>',
      "</div>",
      "</a>",
      "</div>",
    ].join("")
  }

  return [
    '<div class="md-link-card my-4 overflow-hidden rounded-xl border border-border bg-card shadow-xs transition-colors hover:bg-secondary/40">',
    `<a\nclass="md-link-card-link block no-underline" href="${href}" target="_blank" rel="noreferrer nofollow ugc" data-md-link-card-link="true">`,
    '<div class="flex flex-col gap-2 p-4">',
    '<div class="flex items-center gap-2">',
    '<span class="md-link-card-badge inline-flex shrink-0 items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-600 dark:bg-blue-500/15 dark:text-blue-300">外链</span>',
    `<span class="truncate font-semibold text-foreground">${displayHost}</span>`,
    "</div>",
    `<span class="break-all text-xs text-muted-foreground">${displayUrl}</span>`,
    '<p class="text-xs leading-6 text-muted-foreground">外部链接：不加载任何外部内容，点击后在新标签页打开。</p>',
    "</div>",
    "</a>",
    "</div>",
  ].join("")
}
