import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

import type { ForumFeedItem } from "../src/lib/forum-feed"
import { resolveFeedPrimaryTime } from "../src/lib/forum-feed-display"

const root = process.cwd()

const feedItem = {
  publishedAt: "published-time",
  publishedAtRaw: "2026-07-27T01:00:00.000Z",
  activityAt: "activity-time",
  activityAtRaw: "2026-07-27T05:00:00.000Z",
  lastRepliedAt: "reply-time",
  lastRepliedAtRaw: "2026-07-27T03:00:00.000Z",
} as ForumFeedItem

test("latest feed displays the same activity timestamp used for ordering", () => {
  assert.deepEqual(resolveFeedPrimaryTime(feedItem, "latest"), {
    label: "activity-time",
    raw: "2026-07-27T05:00:00.000Z",
  })
})

test("new feed continues to display the original published timestamp", () => {
  assert.deepEqual(resolveFeedPrimaryTime(feedItem, "new"), {
    label: "published-time",
    raw: "2026-07-27T01:00:00.000Z",
  })
})

test("feed mapping carries activityAt separately from reply and publish timestamps", async () => {
  const source = await readFile(path.join(root, "src/lib/forum-feed.ts"), "utf8")

  assert.match(source, /activityAtRaw = feedPost\.activityAt \?\? feedPost\.lastCommentedAt \?\? publishedAtRaw/)
  assert.match(source, /activityAt: formatRelativeTime\(activityAtRaw\)/)
  assert.match(source, /activityAtRaw: activityAtRaw\.toISOString\(\)/)
})
