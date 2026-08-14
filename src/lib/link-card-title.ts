import { createHash } from "node:crypto"
import { lookup } from "node:dns/promises"
import { isIP } from "node:net"

import { registerBackgroundJobHandler, enqueueBackgroundJob } from "@/lib/background-jobs"
import { collectExternalLinkCardUrls } from "@/lib/link-card-embed"
import { logError, logInfo } from "@/lib/logger"
import { createRedisKey, withRedis } from "@/lib/redis"

const LINK_CARD_TITLE_FETCH_TIMEOUT_MS = 8_000
const LINK_CARD_TITLE_MAX_REDIRECTS = 3
const LINK_CARD_TITLE_MAX_RESPONSE_BYTES = 512 * 1024
const LINK_CARD_TITLE_MAX_LENGTH = 200
const LINK_CARD_TITLE_CACHE_TTL_SECONDS = 30 * 24 * 60 * 60
const LINK_CARD_TITLE_EMPTY_CACHE_TTL_SECONDS = 24 * 60 * 60
const LINK_CARD_TITLE_USER_AGENT = "Rhex Link Card Title Fetcher/1.0"
const LINK_CARD_TITLE_ACCEPT_HEADER = "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1"

function digestUrl(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 24)
}

function linkCardTitleCacheKey(url: string) {
  return createRedisKey("link-card", "title", digestUrl(url))
}

export type LinkCardTitleCacheValue = {
  title: string | null
  fetchedAt: string
}

function parseLinkCardTitleCacheValue(value: string | null): LinkCardTitleCacheValue | null {
  if (!value) {
    return null
  }

  try {
    const parsed = JSON.parse(value) as Partial<LinkCardTitleCacheValue>
    if (typeof parsed !== "object" || parsed === null || typeof parsed.fetchedAt !== "string") {
      return null
    }

    return {
      title: typeof parsed.title === "string" ? parsed.title : null,
      fetchedAt: parsed.fetchedAt,
    }
  } catch {
    return null
  }
}

export async function readLinkCardTitleCache(urls: readonly string[]): Promise<Map<string, string>> {
  const uniqueUrls = Array.from(new Set(urls.filter((url) => typeof url === "string" && url.length > 0)))
  if (uniqueUrls.length === 0) {
    return new Map()
  }

  try {
    return await withRedis("link-card-title", async (redis) => {
      const values = await redis.mget(...uniqueUrls.map((url) => linkCardTitleCacheKey(url)))
      const titles = new Map<string, string>()

      for (let index = 0; index < uniqueUrls.length; index += 1) {
        const cached = parseLinkCardTitleCacheValue(values[index] ?? null)
        const title = cached?.title?.trim()
        if (title) {
          titles.set(uniqueUrls[index], title)
        }
      }

      return titles
    })
  } catch (error) {
    logError({
      scope: "link-card-title",
      action: "read-cache",
    }, error)
    return new Map()
  }
}

async function writeLinkCardTitleCache(url: string, title: string | null) {
  const value: LinkCardTitleCacheValue = {
    title: title?.trim() || null,
    fetchedAt: new Date().toISOString(),
  }

  await withRedis("link-card-title", async (redis) => {
    await redis.set(
      linkCardTitleCacheKey(url),
      JSON.stringify(value),
      "EX",
      title?.trim()
        ? LINK_CARD_TITLE_CACHE_TTL_SECONDS
        : LINK_CARD_TITLE_EMPTY_CACHE_TTL_SECONDS,
    )
  })
}

function isPrivateIpv4(ip: string) {
  const [a = 0, b = 0] = ip.split(".").map((item) => Number(item))

  if (a === 10 || a === 127 || a === 0) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 100 && b >= 64 && b <= 127) return true
  if (a === 198 && (b === 18 || b === 19)) return true
  if (a >= 224) return true

  return false
}

function isPrivateIpv6(ip: string) {
  const normalized = ip.toLowerCase()

  if (normalized === "::1" || normalized === "::") return true
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true
  if (normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) return true

  return false
}

async function assertSafeOutboundTitleUrl(rawUrl: string) {
  const url = new URL(rawUrl)

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("仅允许抓取 http 或 https 地址")
  }

  if (url.username || url.password) {
    throw new Error("抓取地址不允许包含账号密码")
  }

  const hostname = url.hostname.trim().toLowerCase()
  if (!hostname) {
    throw new Error("抓取地址缺少主机名")
  }

  if (hostname === "localhost" || hostname.endsWith(".local")) {
    throw new Error("禁止抓取本地或局域网地址")
  }

  const ipVersion = isIP(hostname)
  if (ipVersion === 4) {
    if (isPrivateIpv4(hostname)) {
      throw new Error("禁止抓取内网 IPv4 地址")
    }
    return
  }

  if (ipVersion === 6) {
    if (isPrivateIpv6(hostname)) {
      throw new Error("禁止抓取内网 IPv6 地址")
    }
    return
  }

  const addresses = await lookup(hostname, { all: true, verbatim: true })
  if (addresses.length === 0) {
    throw new Error("主机名解析失败")
  }

  for (const address of addresses) {
    if ((address.family === 4 && isPrivateIpv4(address.address)) || (address.family === 6 && isPrivateIpv6(address.address))) {
      throw new Error("目标主机解析到了内网地址，已拒绝访问")
    }
  }
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_matched, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_matched, code: string) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
}

function extractPageTitle(html: string): string | null {
  const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']*)["']/i)
    ?? html.match(/<meta[^>]+content=["']([^"']*)["'][^>]*property=["']og:title["']/i)
  const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)

  const raw = (ogTitle?.[1] ?? titleTag?.[1] ?? "").trim()
  if (!raw) {
    return null
  }

  const normalized = decodeHtmlEntities(raw)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  return normalized ? normalized.slice(0, LINK_CARD_TITLE_MAX_LENGTH) : null
}

async function readResponseBodyText(response: Response, maxBytes: number) {
  const reader = response.body?.getReader()
  if (!reader) {
    return ""
  }

  const chunks: Uint8Array[] = []
  let total = 0

  while (true) {
    const chunk = await reader.read()
    if (chunk.done) {
      break
    }

    total += chunk.value.byteLength
    if (total > maxBytes) {
      await reader.cancel()
      return ""
    }

    chunks.push(chunk.value)
  }

  const buffer = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)))
  return new TextDecoder("utf-8", { fatal: false }).decode(buffer)
}

export async function fetchLinkCardTitle(rawUrl: string): Promise<string | null> {
  let currentUrl = rawUrl

  for (let redirectCount = 0; redirectCount <= LINK_CARD_TITLE_MAX_REDIRECTS; redirectCount += 1) {
    await assertSafeOutboundTitleUrl(currentUrl)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), LINK_CARD_TITLE_FETCH_TIMEOUT_MS)

    try {
      const response = await fetch(currentUrl, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          Accept: LINK_CARD_TITLE_ACCEPT_HEADER,
          "User-Agent": LINK_CARD_TITLE_USER_AGENT,
        },
      })

      const status = response.status
      const location = response.headers.get("location")

      if (status >= 300 && status < 400) {
        if (!location) {
          throw new Error(`收到 ${status} 重定向但缺少 Location`)
        }

        currentUrl = new URL(location, currentUrl).toString()
        continue
      }

      if (!response.ok) {
        throw new Error(`抓取失败，HTTP ${status}`)
      }

      const html = await readResponseBodyText(response, LINK_CARD_TITLE_MAX_RESPONSE_BYTES)
      return extractPageTitle(html)
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("抓取标题超时")
      }

      throw error
    } finally {
      clearTimeout(timeoutId)
    }
  }

  throw new Error("重定向次数过多")
}

export const LINK_CARD_TITLE_BACKGROUND_JOB_NAME = "link-card.fetch-title"

export type LinkCardTitleBackgroundJobPayload = {
  urls: string[]
}

registerBackgroundJobHandler(LINK_CARD_TITLE_BACKGROUND_JOB_NAME, async (payload) => {
  const urls = Array.isArray(payload?.urls)
    ? payload.urls.filter((url): url is string => typeof url === "string" && url.length > 0)
    : []
  const uniqueUrls = Array.from(new Set(urls))

  if (uniqueUrls.length === 0) {
    return
  }

  const cachedTitles = await readLinkCardTitleCache(uniqueUrls)
  let fetchedCount = 0
  let failedCount = 0

  for (const url of uniqueUrls) {
    if (cachedTitles.has(url)) {
      continue
    }

    try {
      const title = await fetchLinkCardTitle(url)
      await writeLinkCardTitleCache(url, title)
      fetchedCount += 1
    } catch (error) {
      failedCount += 1
      logError({
        scope: "link-card-title",
        action: "fetch",
        metadata: {
          url,
        },
      }, error)
    }
  }

  logInfo({
    scope: "link-card-title",
    action: "complete",
    metadata: {
      total: uniqueUrls.length,
      fetchedCount,
      failedCount,
    },
  })
})

export function enqueueLinkCardTitleFetch(input: {
  content: string
  blockedDomains?: readonly string[]
  internalHosts?: readonly string[]
}) {
  const urls = collectExternalLinkCardUrls(input.content, {
    blockedDomains: input.blockedDomains,
    internalHosts: input.internalHosts,
  })

  if (urls.length === 0) {
    return
  }

  void enqueueBackgroundJob(LINK_CARD_TITLE_BACKGROUND_JOB_NAME, {
    urls,
  }).catch((error) => {
    logError({
      scope: "link-card-title",
      action: "enqueue",
    }, error)
  })
}
