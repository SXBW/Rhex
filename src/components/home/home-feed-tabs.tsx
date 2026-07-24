import Link from "next/link"
import { Clock3, Flame, Globe2, MessageCircle, Sparkles, Star, Users2 } from "lucide-react"

import type { ResolvedHomeFeedTab } from "@/lib/home-feed-tabs"

export function HomeFeedTabs({
  currentKey,
  tabs,
}: {
  currentKey: string
  tabs: ResolvedHomeFeedTab[]
}) {
  return (
    <div className="flex flex-nowrap items-center justify-start gap-1 overflow-x-auto border-b border-border/60 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:gap-1.5 lg:px-3 lg:py-2.5">
      {tabs.map((tab) => {
        const Icon = tab.kind === "builtin"
          ? tab.key === "latest"
            ? Clock3
            : tab.key === "new"
              ? Sparkles
              : tab.key === "hot"
                ? Flame
                : tab.key === "featured"
                  ? Star
                  : tab.key === "following"
                    ? Users2
                    : Globe2
          : MessageCircle
        const active = currentKey === tab.key

        return (
          <Link
            key={tab.key}
            href={tab.href}
            className={active ? "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-accent px-3 py-1.5 text-[13px] font-medium text-foreground sm:text-sm" : "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground sm:text-sm"}
          >
            <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span>{tab.label}</span>
          </Link>
        )
      })}
    </div>
  )
}
