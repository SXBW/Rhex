import { OAuthApplicationsPanel } from "@/components/oauth/oauth-applications-panel"
import type { SettingsPageData } from "@/app/settings/settings-page-loader"

export function OAuthApplicationsSettingsSection({ data }: { data: SettingsPageData }) {
  return (
    <OAuthApplicationsPanel
      enabled={data.oauthApplications.enabled}
      oauthServerEnabled={data.oauthApplications.oauthServerEnabled}
      oauthClientApplicationEnabled={data.oauthApplications.oauthClientApplicationEnabled}
      clients={data.oauthApplications.clients}
      authorizedSites={data.oauthApplications.authorizedSites}
    />
  )
}
