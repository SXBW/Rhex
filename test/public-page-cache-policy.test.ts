import assert from "node:assert/strict"
import test from "node:test"

import {
  normalizePublicPageCacheTarget,
  parsePublicPageCacheTarget,
  resolvePublicPageCacheTarget,
} from "../src/lib/public-page-cache-policy"

function requestContext(overrides: Partial<Parameters<typeof resolvePublicPageCacheTarget>[0]> = {}) {
  return {
    method: "GET",
    pathname: "/",
    searchParams: new URLSearchParams(),
    isRenderRequest: false,
    hasAuthorization: false,
    isReactServerComponent: false,
    hasSession: false,
    hasBrowsingPreferences: false,
    ...overrides,
  }
}

test("anonymous public list and post pages use the shared cache", () => {
  assert.equal(resolvePublicPageCacheTarget(requestContext()), "/")
  assert.equal(
    resolvePublicPageCacheTarget(requestContext({ pathname: "/posts/public-post" })),
    "/posts/public-post",
  )
  assert.equal(
    resolvePublicPageCacheTarget(requestContext({
      pathname: "/hot",
      searchParams: new URLSearchParams("page=2"),
    })),
    "/hot?page=2",
  )
})

test("session, authorization, preferences and RSC requests bypass the shared cache", () => {
  assert.equal(resolvePublicPageCacheTarget(requestContext({ hasSession: true })), null)
  assert.equal(resolvePublicPageCacheTarget(requestContext({ hasAuthorization: true })), null)
  assert.equal(resolvePublicPageCacheTarget(requestContext({ hasBrowsingPreferences: true })), null)
  assert.equal(resolvePublicPageCacheTarget(requestContext({ isReactServerComponent: true })), null)
  assert.equal(resolvePublicPageCacheTarget(requestContext({ isRenderRequest: true })), null)
})

test("mutating and private routes never use the shared cache", () => {
  assert.equal(resolvePublicPageCacheTarget(requestContext({ method: "POST" })), null)
  assert.equal(resolvePublicPageCacheTarget(requestContext({ pathname: "/settings" })), null)
  assert.equal(resolvePublicPageCacheTarget(requestContext({ pathname: "/messages" })), null)
  assert.equal(resolvePublicPageCacheTarget(requestContext({ pathname: "/admin" })), null)
  assert.equal(resolvePublicPageCacheTarget(requestContext({ pathname: "/following" })), null)
})

test("unknown query parameters bypass caching to avoid unbounded cache keys", () => {
  assert.equal(
    normalizePublicPageCacheTarget("/posts/public-post", new URLSearchParams("utm_source=test")),
    null,
  )
  assert.equal(
    normalizePublicPageCacheTarget("/posts/public-post", new URLSearchParams("sort=newest&view=flat")),
    "/posts/public-post?sort=newest&view=flat",
  )
})

test("cache targets cannot escape to another origin", () => {
  assert.equal(parsePublicPageCacheTarget("https://example.com/"), null)
  assert.equal(parsePublicPageCacheTarget("//example.com/"), null)
  assert.equal(parsePublicPageCacheTarget("/posts/public-post"), "/posts/public-post")
})
