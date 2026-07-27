export type RssEntryVideo = {
  platform: "bilibili" | "douyin"
  platformLabel: "bilibili" | "抖音"
  embedUrl: string | null
}

function isHostnameOrSubdomain(hostname: string, domain: string) {
  return hostname === domain || hostname.endsWith(`.${domain}`)
}

function buildBilibiliEmbedUrl(url: URL) {
  const videoId = url.pathname.match(/\/video\/(BV[a-zA-Z0-9]+|av\d+)/i)?.[1]
  const bvid = videoId?.toLowerCase().startsWith("bv")
    ? videoId
    : url.searchParams.get("bvid")
  const aid = videoId?.toLowerCase().startsWith("av")
    ? videoId.slice(2)
    : url.searchParams.get("aid")

  if (!bvid && !aid) {
    return null
  }

  const embedUrl = new URL("https://player.bilibili.com/player.html")
  embedUrl.searchParams.set(bvid ? "bvid" : "aid", bvid ?? aid ?? "")
  embedUrl.searchParams.set("page", url.searchParams.get("p") ?? "1")
  embedUrl.searchParams.set("high_quality", "1")
  embedUrl.searchParams.set("danmaku", "0")
  return embedUrl.toString()
}

function buildDouyinEmbedUrl(url: URL) {
  const videoId = url.pathname.match(/\/video\/(\d+)/)?.[1]
    ?? url.searchParams.get("modal_id")
    ?? url.searchParams.get("vid")

  if (!videoId || !/^\d+$/.test(videoId)) {
    return null
  }

  const embedUrl = new URL("https://open.douyin.com/player/video")
  embedUrl.searchParams.set("vid", videoId)
  embedUrl.searchParams.set("autoplay", "0")
  return embedUrl.toString()
}

export function resolveRssEntryVideo(linkUrl: string | null | undefined): RssEntryVideo | null {
  if (!linkUrl) {
    return null
  }

  let url: URL
  try {
    url = new URL(linkUrl)
  } catch {
    return null
  }

  const hostname = url.hostname.toLowerCase()

  if (isHostnameOrSubdomain(hostname, "bilibili.com") || hostname === "b23.tv") {
    return {
      platform: "bilibili",
      platformLabel: "bilibili",
      embedUrl: buildBilibiliEmbedUrl(url),
    }
  }

  if (isHostnameOrSubdomain(hostname, "douyin.com") || isHostnameOrSubdomain(hostname, "iesdouyin.com")) {
    return {
      platform: "douyin",
      platformLabel: "抖音",
      embedUrl: buildDouyinEmbedUrl(url),
    }
  }

  return null
}
