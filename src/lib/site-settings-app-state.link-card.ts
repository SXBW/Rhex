import { isRecord, readSiteSettingsState, writeSiteSettingsState } from "@/lib/site-settings-app-state.types"
import { normalizeLinkCardBlockedDomains } from "@/lib/link-card-embed"
import type { ExternalLinkCardSettings } from "@/lib/site-settings-app-state.types"

export function resolveExternalLinkCardSettings(options: {
  appStateJson?: string | null
  enabledFallback?: boolean
} = {}): ExternalLinkCardSettings {
  const siteSettingsState = readSiteSettingsState(options.appStateJson)
  const linkCard = isRecord(siteSettingsState.linkCard) ? siteSettingsState.linkCard : {}

  return {
    enabled:
      typeof linkCard.enabled === "boolean"
        ? linkCard.enabled
        : options.enabledFallback ?? true,
    blockedDomains: normalizeLinkCardBlockedDomains(linkCard.blockedDomains),
  }
}

export function mergeExternalLinkCardSettings(
  appStateJson: string | null | undefined,
  input: { enabled: boolean; blockedDomains: string | readonly string[] },
) {
  const siteSettingsState = readSiteSettingsState(appStateJson)

  return writeSiteSettingsState(appStateJson, {
    ...siteSettingsState,
    linkCard: {
      enabled: Boolean(input.enabled),
      blockedDomains: normalizeLinkCardBlockedDomains(input.blockedDomains),
    },
  })
}
