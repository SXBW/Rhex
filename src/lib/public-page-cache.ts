import "server-only"

import { createHash } from "node:crypto"

import { acquireRedisLease } from "@/lib/redis-lease"
import { connectRedisClient, createRedisKey, getRedis, hasRedisUrl } from "@/lib/redis"
import {
  PUBLIC_PAGE_CACHE_STALE_SECONDS,
  PUBLIC_PAGE_CACHE_TTL_SECONDS,
} from "@/lib/public-page-cache-policy"

export interface PublicPageCacheEntry {
  body: string
  headers: Record<string, string>
  status: number
  storedAt: number
}

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 32)
}

function normalizedRuntimeValue(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function deploymentNamespace() {
  return normalizedRuntimeValue(process.env.NEXT_DEPLOYMENT_ID)
    || normalizedRuntimeValue(process.env.GITHUB_SHA)
    || normalizedRuntimeValue(process.env.npm_package_version)
    || "development"
}

function generationKey(scope: string) {
  return createRedisKey("public-page-cache", "generation", scope)
}

function targetScope(target: string) {
  const pathname = target.split("?", 1)[0]
  if (pathname.startsWith("/posts/")) {
    return {
      family: "posts",
      target: `post:${digest(pathname)}`,
    }
  }

  return {
    family: "lists",
    target: null,
  }
}

function entryKey(generation: string, target: string) {
  return createRedisKey("public-page-cache", "entry", deploymentNamespace(), generation, digest(target))
}

function lockKey(generation: string, target: string) {
  return createRedisKey("public-page-cache", "lock", deploymentNamespace(), generation, digest(target))
}

function parseEntry(raw: string | null): PublicPageCacheEntry | null {
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PublicPageCacheEntry>
    if (
      typeof parsed.body !== "string"
      || typeof parsed.status !== "number"
      || typeof parsed.storedAt !== "number"
      || !parsed.headers
      || typeof parsed.headers !== "object"
    ) {
      return null
    }

    return {
      body: parsed.body,
      headers: parsed.headers as Record<string, string>,
      status: parsed.status,
      storedAt: parsed.storedAt,
    }
  } catch {
    return null
  }
}

export function isPublicPageCacheAvailable() {
  return hasRedisUrl()
}

export async function getPublicPageCacheGeneration(target: string) {
  const redis = getRedis()
  await connectRedisClient(redis)
  const scope = targetScope(target)
  const keys = [
    generationKey("global"),
    generationKey(scope.family),
    ...(scope.target ? [generationKey(scope.target)] : []),
  ]
  const generations = await redis.mget(...keys)
  return generations.map((value) => value ?? "0").join(".")
}

export async function readPublicPageCacheEntry(generation: string, target: string) {
  const redis = getRedis()
  await connectRedisClient(redis)
  return parseEntry(await redis.get(entryKey(generation, target)))
}

export async function writePublicPageCacheEntry(
  generation: string,
  target: string,
  entry: PublicPageCacheEntry,
) {
  const redis = getRedis()
  await connectRedisClient(redis)
  await redis.set(
    entryKey(generation, target),
    JSON.stringify(entry),
    "EX",
    PUBLIC_PAGE_CACHE_TTL_SECONDS + PUBLIC_PAGE_CACHE_STALE_SECONDS,
  )
}

export async function acquirePublicPageCacheRenderLease(generation: string, target: string) {
  return acquireRedisLease({
    key: lockKey(generation, target),
    ttlMs: 30_000,
  })
}

export function isFreshPublicPageCacheEntry(entry: PublicPageCacheEntry, now = Date.now()) {
  return now - entry.storedAt < PUBLIC_PAGE_CACHE_TTL_SECONDS * 1_000
}

export async function invalidatePublicPageCache() {
  if (!hasRedisUrl()) {
    return false
  }

  const redis = getRedis()
  await connectRedisClient(redis)
  await redis.incr(generationKey("global"))
  return true
}

export async function invalidatePublicListPageCache() {
  if (!hasRedisUrl()) {
    return false
  }

  const redis = getRedis()
  await connectRedisClient(redis)
  await redis.incr(generationKey("lists"))
  return true
}

export async function invalidatePublicPostPageCache(slug?: string | null) {
  if (!hasRedisUrl()) {
    return false
  }

  const normalizedSlug = slug?.trim()
  const scope = normalizedSlug ? `post:${digest(`/posts/${normalizedSlug}`)}` : "posts"
  const redis = getRedis()
  await connectRedisClient(redis)
  await redis.incr(generationKey(scope))
  return true
}

function scheduleInvalidation(action: () => Promise<boolean>, label: string) {
  if (!hasRedisUrl()) {
    return
  }

  void action().catch((error) => {
    console.error(`[public-page-cache] ${label} invalidation failed`, error)
  })
}

export function schedulePublicPageCacheInvalidation() {
  scheduleInvalidation(invalidatePublicPageCache, "global")
}

export function schedulePublicListPageCacheInvalidation() {
  scheduleInvalidation(invalidatePublicListPageCache, "list")
}

export function schedulePublicPostPageCacheInvalidation(slug?: string | null) {
  scheduleInvalidation(() => invalidatePublicPostPageCache(slug), slug ? "post" : "all-posts")
}
