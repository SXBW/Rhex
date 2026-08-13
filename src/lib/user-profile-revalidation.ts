import "server-only"

import { revalidatePath, revalidateTag } from "next/cache"

import { expireContentListCachesImmediately } from "@/lib/content-list-cache"
import {
  POST_COMMENT_LIST_CACHE_TAG,
  POST_DETAIL_DATA_CACHE_TAG,
  POST_SIDEBAR_CACHE_TAG,
  POST_VIEWER_CACHE_TAG,
} from "@/lib/post-detail-cache"
import { schedulePublicPostPageCacheInvalidation } from "@/lib/public-page-cache"
import { revalidateUserSurfaceCache } from "@/lib/user-surface"

function safeRevalidatePath(path: string, type?: "page" | "layout") {
  try {
    if (type) {
      revalidatePath(path, type)
      return
    }

    revalidatePath(path)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (
      message.startsWith("Invariant: static generation store missing in revalidatePath")
      || message.includes('used "revalidatePath ')
    ) {
      return
    }

    throw error
  }
}

function safeExpireTag(tag: string) {
  try {
    revalidateTag(tag, { expire: 0 })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (
      message.startsWith("Invariant: static generation store missing in revalidateTag")
      || message.includes('used "revalidateTag ')
    ) {
      return
    }

    throw error
  }
}

export function revalidateUserProfileMutation(input: {
  userId: number
  username: string
}) {
  revalidateUserSurfaceCache(input.userId)
  safeRevalidatePath("/settings")
  safeRevalidatePath("/users/[username]", "page")
  safeRevalidatePath(`/users/${input.username}`)
  safeRevalidatePath(`/api/users/${input.username}/preview`)
}

export function revalidateVerificationMutation(input: {
  userId: number
  username: string
}) {
  revalidateUserProfileMutation(input)
  expireContentListCachesImmediately()
  safeExpireTag(POST_DETAIL_DATA_CACHE_TAG)
  safeExpireTag(POST_COMMENT_LIST_CACHE_TAG)
  safeExpireTag(POST_SIDEBAR_CACHE_TAG)
  safeExpireTag(POST_VIEWER_CACHE_TAG)
  schedulePublicPostPageCacheInvalidation()
  safeRevalidatePath("/", "layout")
  safeRevalidatePath("/posts/[slug]", "page")
}
