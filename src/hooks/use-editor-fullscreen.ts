"use client"

import { useEffect, useState } from "react"

export function useEditorFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const check = () => {
      setIsFullscreen(
        document.querySelector("[data-markdown-editor-fullscreen='true']") !== null,
      )
    }

    check()

    const observer = new MutationObserver(check)
    observer.observe(document.body, {
      attributes: true,
      childList: true,
      subtree: true,
    })

    return () => observer.disconnect()
  }, [])

  return isFullscreen
}
