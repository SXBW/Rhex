import { after } from "next/server"

import {
  acquirePublicPageCacheRenderLease,
  getPublicPageCacheGeneration,
  isFreshPublicPageCacheEntry,
  isPublicPageCacheAvailable,
  type PublicPageCacheEntry,
  readPublicPageCacheEntry,
  writePublicPageCacheEntry,
} from "@/lib/public-page-cache"
import {
  parsePublicPageCacheTarget,
  PUBLIC_PAGE_CACHE_RENDER_HEADER,
  PUBLIC_PAGE_CACHE_STALE_SECONDS,
  PUBLIC_PAGE_CACHE_TARGET_HEADER,
  PUBLIC_PAGE_CACHE_TTL_SECONDS,
} from "@/lib/public-page-cache-policy"

export const dynamic = "force-dynamic"

const CACHEABLE_RESPONSE_HEADERS = [
  "content-language",
  "content-type",
  "link",
  "location",
  "vary",
  "x-powered-by",
] as const

function getInternalOrigin() {
  const rawPort = Number(process.env.PORT ?? "3000")
  const port = Number.isSafeInteger(rawPort) && rawPort > 0 && rawPort <= 65_535 ? rawPort : 3000
  return `http://127.0.0.1:${port}`
}

function buildResponse(entry: PublicPageCacheEntry, method: string, cacheStatus: string) {
  const headers = new Headers(entry.headers)
  headers.set(
    "Cache-Control",
    `public, s-maxage=${PUBLIC_PAGE_CACHE_TTL_SECONDS}, stale-while-revalidate=${PUBLIC_PAGE_CACHE_STALE_SECONDS}`,
  )
  headers.set("X-Rhex-Cache", cacheStatus)

  return new Response(method === "HEAD" ? null : entry.body, {
    status: entry.status,
    headers,
  })
}

function getCacheIdentity(request: Request, target: string) {
  const host = request.headers.get("host")?.trim().toLowerCase() || "default"
  return `${host}\n${target}`
}

async function renderTarget(request: Request, target: string) {
  const headers = new Headers()
  headers.set("Accept", "text/html")
  headers.set("User-Agent", "Mozilla/5.0 (compatible; RhexPublicPageCache/1.0)")
  headers.set(PUBLIC_PAGE_CACHE_RENDER_HEADER, "1")

  const acceptLanguage = request.headers.get("accept-language")
  if (acceptLanguage) {
    headers.set("Accept-Language", acceptLanguage)
  }

  const response = await fetch(new URL(target, getInternalOrigin()), {
    method: "GET",
    headers,
    cache: "no-store",
    redirect: "manual",
  })
  const body = await response.text()
  const responseHeaders: Record<string, string> = {}

  for (const name of CACHEABLE_RESPONSE_HEADERS) {
    const value = response.headers.get(name)
    if (value) {
      responseHeaders[name] = value
    }
  }

  return {
    entry: {
      body,
      headers: responseHeaders,
      status: response.status,
      storedAt: Date.now(),
    } satisfies PublicPageCacheEntry,
    cacheable: response.status === 200
      && response.headers.get("content-type")?.toLowerCase().includes("text/html") === true,
  }
}

async function waitForColdCache(generation: string, target: string) {
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 75))
    const entry = await readPublicPageCacheEntry(generation, target)
    if (entry) {
      return entry
    }
  }
  return null
}

async function handle(request: Request) {
  const target = parsePublicPageCacheTarget(
    request.headers.get(PUBLIC_PAGE_CACHE_TARGET_HEADER)?.trim() ?? "",
  )

  if (!target) {
    return new Response("Not Found", { status: 404 })
  }

  if (!isPublicPageCacheAvailable()) {
    const rendered = await renderTarget(request, target)
    return buildResponse(rendered.entry, request.method, "BYPASS")
  }

  try {
    const generation = await getPublicPageCacheGeneration(target)
    const cacheIdentity = getCacheIdentity(request, target)
    const cached = await readPublicPageCacheEntry(generation, cacheIdentity)

    if (cached && isFreshPublicPageCacheEntry(cached)) {
      return buildResponse(cached, request.method, "HIT")
    }

    const lease = await acquirePublicPageCacheRenderLease(generation, cacheIdentity)
    if (!lease) {
      if (cached) {
        return buildResponse(cached, request.method, "STALE")
      }

      const filled = await waitForColdCache(generation, cacheIdentity)
      if (filled) {
        return buildResponse(filled, request.method, "HIT")
      }

      const rendered = await renderTarget(request, target)
      return buildResponse(rendered.entry, request.method, "BYPASS")
    }

    if (cached) {
      after(async () => {
        try {
          const rendered = await renderTarget(request, target)
          if (rendered.cacheable) {
            await writePublicPageCacheEntry(generation, cacheIdentity, rendered.entry)
          }
        } catch (error) {
          console.error("[public-page-cache] background refresh failed", error)
        } finally {
          await lease.release().catch(() => false)
        }
      })
      return buildResponse(cached, request.method, "STALE")
    }

    try {
      const renderedResult = await renderTarget(request, target)
      if (renderedResult.cacheable) {
        await writePublicPageCacheEntry(generation, cacheIdentity, renderedResult.entry)
      }
      const rendered = renderedResult.entry
      return buildResponse(rendered, request.method, "MISS")
    } finally {
      await lease.release().catch(() => false)
    }
  } catch (error) {
    console.error("[public-page-cache] request failed", error)
    const rendered = await renderTarget(request, target)
    return buildResponse(rendered.entry, request.method, "BYPASS")
  }
}

export const GET = handle
export const HEAD = handle
