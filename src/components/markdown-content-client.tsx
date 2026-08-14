"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { Slide } from "yet-another-react-lightbox"

import { useMarkdownEmojiMap } from "@/components/site-settings-provider"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { bindBase64Inspector, bindBrokenImagePlaceholders, bindExternalLinkRiskConfirmation, bindImageLightbox, enhanceMarkdown, type ExternalLinkRiskInfo, type LightboxImage } from "@/lib/markdown/enhance"
import type { MarkdownEmojiItem } from "@/lib/markdown-emoji"
import type { PostContentImageMode } from "@/lib/theme"
import { cn } from "@/lib/utils"

interface MarkdownContentClientProps {
  content: string
  html?: string
  className?: string
  emptyText?: string
  markdownEmojiMap?: MarkdownEmojiItem[]
  expandImagesWhenImageOnly?: boolean
  imageDisplayMode?: PostContentImageMode
  imageOnly?: boolean
  collapseLongCodeBlocks?: boolean
}

interface MarkdownBodyProps {
  html: string
  className?: string
  onOpenLightbox: (images: LightboxImage[], index: number) => void
  onRequestExternalLink: (info: ExternalLinkRiskInfo) => void
  imageDisplayMode?: PostContentImageMode
  isImageOnly?: boolean
  collapseLongCodeBlocks?: boolean
}

interface LightboxState {
  images: LightboxImage[]
  index: number
}

interface LightboxPortalProps {
  lightbox: LightboxState
  onClose: () => void
  onChange: (index: number) => void
}

type LightboxModule = typeof import("yet-another-react-lightbox")
type LightboxPluginsModule = typeof import("yet-another-react-lightbox/plugins")

interface LoadedLightboxModules {
  Lightbox: LightboxModule["default"]
  Counter: LightboxPluginsModule["Counter"]
  Zoom: LightboxPluginsModule["Zoom"]
  Fullscreen: LightboxPluginsModule["Fullscreen"]
}

function isImageOnlyHtml(html: string) {
  const normalized = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(\/)?(?:p|div|figure|span|a|picture)\b[^>]*>/gi, "")
    .replace(/<br\s*\/?>/gi, "")
    .replace(/<img\b[^>]*>/gi, "__MD_IMG__")
    .replace(/(?:&nbsp;|&#160;|\s)+/gi, "")

  if (!normalized.includes("__MD_IMG__")) {
    return false
  }

  return normalized.replace(/__MD_IMG__/g, "") === ""
}

function LightboxPortal({ lightbox, onClose, onChange }: LightboxPortalProps) {
  const [loadedModules, setLoadedModules] = useState<LoadedLightboxModules | null>(null)
  const slides = useMemo<Slide[]>(
    () => lightbox.images.map((item) => ({ src: item.src, alt: item.alt })),
    [lightbox.images],
  )
  const render = useMemo(
    () => ({
      iconPrev: () => (
        <span className="markdown-lightbox-nav-icon" aria-hidden="true">
          <ChevronLeft size={20} strokeWidth={2.25} />
        </span>
      ),
      iconNext: () => (
        <span className="markdown-lightbox-nav-icon" aria-hidden="true">
          <ChevronRight size={20} strokeWidth={2.25} />
        </span>
      ),
    }),
    [],
  )

  useEffect(() => {
    let cancelled = false

    void Promise.all([
      import("yet-another-react-lightbox"),
      import("yet-another-react-lightbox/plugins"),
      import("yet-another-react-lightbox/styles.css"),
      import("yet-another-react-lightbox/plugins/counter.css"),
    ]).then(([lightboxModule, pluginsModule]) => {
      if (cancelled) {
        return
      }

      setLoadedModules({
        Lightbox: lightboxModule.default,
        Counter: pluginsModule.Counter,
        Zoom: pluginsModule.Zoom,
        Fullscreen: pluginsModule.Fullscreen,
      })
    })

    return () => {
      cancelled = true
    }
  }, [])

  if (!loadedModules) {
    return null
  }

  const { Lightbox, Counter, Zoom, Fullscreen } = loadedModules

  return (
    <Lightbox
      className="markdown-lightbox-viewer"
      open
      close={onClose}
      index={lightbox.index}
      slides={slides}
      plugins={[Counter, Zoom, Fullscreen]}
      counter={{
        container: {
          className: "markdown-lightbox-counter",
        },
        separator: " / ",
      }}
      controller={{
        closeOnBackdropClick: true,
      }}
      carousel={{
        padding: 0,
        spacing: "12px",
      }}
      zoom={{
        maxZoomPixelRatio: 4,
        scrollToZoom: true,
      }}
      render={render}
      labels={{
        Previous: "上一张",
        Next: "下一张",
        Close: "关闭",
      }}
      on={{
        view: ({ index }) => onChange(index),
      }}
    />
  )
}

const MarkdownBody = memo(function MarkdownBody({ html, className, onOpenLightbox, onRequestExternalLink, imageDisplayMode = "auto", isImageOnly = false, collapseLongCodeBlocks = false }: MarkdownBodyProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container || !html) {
      return
    }

    const removeBase64Inspector = bindBase64Inspector(container)
    const removeBrokenImagePlaceholders = bindBrokenImagePlaceholders(container)
    const removeExternalLinkConfirmation = bindExternalLinkRiskConfirmation(container, onRequestExternalLink)
    let removeMarkdownEnhancements = () => {}
    let removeImageLightbox = () => {}
    let cancelled = false

    if (container.querySelector(".katex")) {
      void import("katex/dist/katex.min.css")
    }

    void enhanceMarkdown(container, { collapseLongCodeBlocks }).then((cleanup) => {
      if (cancelled) {
        cleanup()
        return
      }

      removeMarkdownEnhancements = cleanup
      removeImageLightbox = bindImageLightbox(container, onOpenLightbox)
    })

    return () => {
      cancelled = true
      removeBase64Inspector()
      removeBrokenImagePlaceholders()
      removeExternalLinkConfirmation()
      removeMarkdownEnhancements()
      removeImageLightbox()
    }
  }, [collapseLongCodeBlocks, html, onOpenLightbox, onRequestExternalLink])

  return (
    <div
      ref={containerRef}
      suppressHydrationWarning
      className={cn(
        "markdown-body prose prose-sm max-w-none prose-p:my-3 prose-ul:my-3 prose-ol:my-3 prose-li:my-1",
        imageDisplayMode === "large" && "markdown-body--large-images",
        imageDisplayMode === "small" && "markdown-body--small-images",
        isImageOnly && "markdown-body--image-only",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
})

export function MarkdownContentClient({ content, html, className, emptyText, markdownEmojiMap, expandImagesWhenImageOnly = false, imageDisplayMode = "auto", imageOnly, collapseLongCodeBlocks = false }: MarkdownContentClientProps) {
  const [lightbox, setLightbox] = useState<LightboxState | null>(null)
  const [pendingExternalLink, setPendingExternalLink] = useState<ExternalLinkRiskInfo | null>(null)
  const [clientRenderedHtml, setClientRenderedHtml] = useState("")
  const [clientRenderedImageOnly, setClientRenderedImageOnly] = useState(false)
  const normalized = useMemo(() => content.replace(/\r\n/g, "\n").trim(), [content])
  const resolvedMarkdownEmojiMap = useMarkdownEmojiMap(markdownEmojiMap)
  const hasProvidedHtml = typeof html === "string"
  const resolvedHtml = hasProvidedHtml ? html : clientRenderedHtml

  useEffect(() => {
    if (hasProvidedHtml || !normalized) {
      setClientRenderedHtml("")
      setClientRenderedImageOnly(false)
      return
    }

    let cancelled = false
    setClientRenderedHtml("")
    setClientRenderedImageOnly(false)

    void import("@/lib/markdown/render").then(({ renderMarkdown, isImageOnlyMarkdownHtml }) => {
      if (cancelled) {
        return
      }

      const nextHtml = renderMarkdown(normalized, resolvedMarkdownEmojiMap)
      setClientRenderedHtml(nextHtml)
      setClientRenderedImageOnly(isImageOnlyMarkdownHtml(nextHtml))
    })

    return () => {
      cancelled = true
    }
  }, [hasProvidedHtml, normalized, resolvedMarkdownEmojiMap])

  const isImageOnly = useMemo(() => {
    if (!expandImagesWhenImageOnly) {
      return false
    }

    if (typeof imageOnly === "boolean") {
      return imageOnly
    }

    if (!resolvedHtml) {
      return false
    }

    return hasProvidedHtml ? isImageOnlyHtml(resolvedHtml) : clientRenderedImageOnly
  }, [clientRenderedImageOnly, expandImagesWhenImageOnly, hasProvidedHtml, imageOnly, resolvedHtml])
  const handleOpenLightbox = useCallback((images: LightboxImage[], index: number) => {
    setLightbox({ images, index })
  }, [])
  const handleRequestExternalLink = useCallback((info: ExternalLinkRiskInfo) => {
    setPendingExternalLink(info)
  }, [])
  const handleOpenExternalLink = useCallback(() => {
    if (!pendingExternalLink) {
      return
    }

    window.open(pendingExternalLink.href, "_blank", "noopener,noreferrer")
    setPendingExternalLink(null)
  }, [pendingExternalLink])

  if (!resolvedHtml) {
    return !normalized && emptyText ? <p className="text-sm text-muted-foreground">{emptyText}</p> : null
  }

  return (
    <>
      <MarkdownBody html={resolvedHtml} className={className} onOpenLightbox={handleOpenLightbox} onRequestExternalLink={handleRequestExternalLink} imageDisplayMode={imageDisplayMode} isImageOnly={isImageOnly} collapseLongCodeBlocks={collapseLongCodeBlocks} />
      {lightbox ? (
        <LightboxPortal
          lightbox={lightbox}
          onClose={() => setLightbox(null)}
          onChange={(index) => setLightbox((previous) => previous ? { ...previous, index } : previous)}
        />
      ) : null}
      <AlertDialog
        open={Boolean(pendingExternalLink)}
        onOpenChange={(open) => {
          if (!open) {
            setPendingExternalLink(null)
          }
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingExternalLink?.blocked ? "风险外链警告" : "外部链接提示"}</AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-line leading-6">
              {pendingExternalLink?.blocked
                ? "该链接指向的外部域名已被本站列入风险黑名单，请谨慎访问，注意个人信息与账户安全，不要在陌生站点输入密码或支付信息。\n\n确认仍要打开吗？"
                : "该链接为外部网站，请谨慎访问，注意安全性。\n\n确认后将在新标签页打开。"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-w-24">取消</AlertDialogCancel>
            <AlertDialogAction
              className={cn(
                "min-w-24",
                pendingExternalLink?.blocked
                  ? "bg-rose-600 text-white hover:bg-rose-700 dark:bg-rose-500 dark:hover:bg-rose-600"
                  : ""
              )}
              onClick={handleOpenExternalLink}
            >
              {pendingExternalLink?.blocked ? "仍要访问" : "继续访问"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
