import { Prisma, type PrismaClient } from "@prisma/client"

import { prisma } from "@/db/client"

type PostScoreQueryClient = Prisma.TransactionClient | PrismaClient

function resolveClient(client?: PostScoreQueryClient) {
  return client ?? prisma
}

export function recalculatePostScore(postId: string, client?: PostScoreQueryClient) {
  return resolveClient(client).$executeRaw`
    WITH heat_settings AS (
      SELECT
        COALESCE((SELECT "heatViewWeight" FROM "SiteSetting" ORDER BY "updatedAt" DESC LIMIT 1), 1) AS "viewWeight",
        COALESCE((SELECT "heatCommentWeight" FROM "SiteSetting" ORDER BY "updatedAt" DESC LIMIT 1), 8) AS "commentWeight",
        COALESCE((SELECT "heatLikeWeight" FROM "SiteSetting" ORDER BY "updatedAt" DESC LIMIT 1), 6) AS "likeWeight",
        COALESCE((SELECT "heatTipCountWeight" FROM "SiteSetting" ORDER BY "updatedAt" DESC LIMIT 1), 10) AS "tipCountWeight",
        COALESCE((SELECT "heatTipPointsWeight" FROM "SiteSetting" ORDER BY "updatedAt" DESC LIMIT 1), 1) AS "tipPointsWeight"
    )
    UPDATE "Post"
    SET "score" =
      "viewCount" * heat_settings."viewWeight"
      + "commentCount" * heat_settings."commentWeight"
      + "likeCount" * heat_settings."likeWeight"
      + "tipCount" * heat_settings."tipCountWeight"
      + "tipTotalPoints" * heat_settings."tipPointsWeight"
    FROM heat_settings
    WHERE "id" = ${postId}
  `
}

export function recalculatePostScores(postIds: string[], client?: PostScoreQueryClient) {
  const normalizedPostIds = [...new Set(postIds.map((postId) => postId.trim()).filter(Boolean))]

  if (normalizedPostIds.length === 0) {
    return Promise.resolve(0)
  }

  return resolveClient(client).$executeRaw`
    WITH heat_settings AS (
      SELECT
        COALESCE((SELECT "heatViewWeight" FROM "SiteSetting" ORDER BY "updatedAt" DESC LIMIT 1), 1) AS "viewWeight",
        COALESCE((SELECT "heatCommentWeight" FROM "SiteSetting" ORDER BY "updatedAt" DESC LIMIT 1), 8) AS "commentWeight",
        COALESCE((SELECT "heatLikeWeight" FROM "SiteSetting" ORDER BY "updatedAt" DESC LIMIT 1), 6) AS "likeWeight",
        COALESCE((SELECT "heatTipCountWeight" FROM "SiteSetting" ORDER BY "updatedAt" DESC LIMIT 1), 10) AS "tipCountWeight",
        COALESCE((SELECT "heatTipPointsWeight" FROM "SiteSetting" ORDER BY "updatedAt" DESC LIMIT 1), 1) AS "tipPointsWeight"
    )
    UPDATE "Post"
    SET "score" =
      "viewCount" * heat_settings."viewWeight"
      + "commentCount" * heat_settings."commentWeight"
      + "likeCount" * heat_settings."likeWeight"
      + "tipCount" * heat_settings."tipCountWeight"
      + "tipTotalPoints" * heat_settings."tipPointsWeight"
    FROM heat_settings
    WHERE "id" IN (${Prisma.join(normalizedPostIds)})
  `
}

export function recalculateAllPostScores(client?: PostScoreQueryClient) {
  return resolveClient(client).$executeRaw`
    WITH heat_settings AS (
      SELECT
        COALESCE((SELECT "heatViewWeight" FROM "SiteSetting" ORDER BY "updatedAt" DESC LIMIT 1), 1) AS "viewWeight",
        COALESCE((SELECT "heatCommentWeight" FROM "SiteSetting" ORDER BY "updatedAt" DESC LIMIT 1), 8) AS "commentWeight",
        COALESCE((SELECT "heatLikeWeight" FROM "SiteSetting" ORDER BY "updatedAt" DESC LIMIT 1), 6) AS "likeWeight",
        COALESCE((SELECT "heatTipCountWeight" FROM "SiteSetting" ORDER BY "updatedAt" DESC LIMIT 1), 10) AS "tipCountWeight",
        COALESCE((SELECT "heatTipPointsWeight" FROM "SiteSetting" ORDER BY "updatedAt" DESC LIMIT 1), 1) AS "tipPointsWeight"
    )
    UPDATE "Post"
    SET "score" =
      "viewCount" * heat_settings."viewWeight"
      + "commentCount" * heat_settings."commentWeight"
      + "likeCount" * heat_settings."likeWeight"
      + "tipCount" * heat_settings."tipCountWeight"
      + "tipTotalPoints" * heat_settings."tipPointsWeight"
    FROM heat_settings
  `
}
