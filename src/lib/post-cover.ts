import { getPublicPostContentText } from "@/lib/post-content"

const HTML_IMAGE_PATTERN = /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/i
const MARKDOWN_IMAGE_PATTERN = /!\[[^\]]*]\((?:<)?([^)\s>]+)(?:[^)]*)\)/i
const CONTENT_IMAGE_PATTERN = /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>|!\[[^\]]*]\((?:<)?([^)\s>]+)(?:[^)]*)\)/gi

function normalizeImageUrl(value: string | null | undefined) {
  const normalized = String(value ?? "").trim()
  return normalized.length > 0 ? normalized : null
}

export function extractFirstImageFromText(rawText: string) {
  const htmlMatch = rawText.match(HTML_IMAGE_PATTERN)
  if (htmlMatch?.[1]) {
    return normalizeImageUrl(htmlMatch[1])
  }

  const markdownMatch = rawText.match(MARKDOWN_IMAGE_PATTERN)
  if (markdownMatch?.[1]) {
    return normalizeImageUrl(markdownMatch[1])
  }

  return null
}

export function extractImagesFromText(rawText: string) {
  const images: string[] = []
  const seen = new Set<string>()

  for (const match of rawText.matchAll(CONTENT_IMAGE_PATTERN)) {
    const imageUrl = normalizeImageUrl(match[1] ?? match[2])
    if (!imageUrl || seen.has(imageUrl)) {
      continue
    }

    seen.add(imageUrl)
    images.push(imageUrl)
  }

  return images
}

export function resolvePostCoverImage(rawContent: string, manualCoverPath?: string | null) {
  const manualCover = normalizeImageUrl(manualCoverPath)
  if (manualCover) {
    return manualCover
  }

  const publicContent = getPublicPostContentText(rawContent)
  return extractFirstImageFromText(publicContent)
}
