"use client"

import Link from "next/link"
import { useState } from "react"

import { OAuthServerAdminPage } from "@/components/admin/oauth-server-admin-page"
import {
  AdminBooleanSelectField,
  SettingsInputField as TextField,
  SettingsSection,
} from "@/components/admin/admin-settings-fields"
import { Button } from "@/components/ui/rbutton"
import { useAdminMutation } from "@/hooks/use-admin-mutation"
import { adminPost } from "@/lib/admin-client"
import type { OAuthClientAdminPageData } from "@/lib/oauth-server"

interface AdminOAuthSettingsInitialSettings {
  oauthServerEnabled: boolean
  oauthClientApplicationEnabled: boolean
  oauthAccessTokenTtlMinutes: number
  oauthRefreshTokenTtlDays: number
}

interface AdminOAuthSettingsPageProps {
  activeSubTab?: string
  initialSettings: AdminOAuthSettingsInitialSettings
  initialClients?: OAuthClientAdminPageData | null
}

export function AdminOAuthSettingsPage({
  activeSubTab = "settings",
  initialSettings,
  initialClients,
}: AdminOAuthSettingsPageProps) {
  if (activeSubTab === "clients") {
    if (!initialClients) {
      return null
    }

    return (
      <OAuthServerAdminPage
        initialData={initialClients}
        basePath="/admin/settings/oauth/clients"
        settingsHref="/admin/settings/oauth/settings"
      />
    )
  }

  return <AdminOAuthSettingsForm initialSettings={initialSettings} />
}

function AdminOAuthSettingsForm({
  initialSettings,
}: {
  initialSettings: AdminOAuthSettingsInitialSettings
}) {
  const [draft, setDraft] = useState(() => ({
    oauthServerEnabled: Boolean(initialSettings.oauthServerEnabled),
    oauthClientApplicationEnabled: Boolean(initialSettings.oauthClientApplicationEnabled),
    oauthAccessTokenTtlMinutes: String(initialSettings.oauthAccessTokenTtlMinutes ?? 60),
    oauthRefreshTokenTtlDays: String(initialSettings.oauthRefreshTokenTtlDays ?? 30),
  }))
  const { isPending, runMutation } = useAdminMutation()

  function updateDraft<Key extends keyof typeof draft>(field: Key, value: (typeof draft)[Key]) {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault()
        runMutation({
          mutation: () =>
            adminPost(
              "/api/admin/site-settings",
              {
                section: "site-oauth",
                oauthServerEnabled: draft.oauthServerEnabled,
                oauthClientApplicationEnabled: draft.oauthClientApplicationEnabled,
                oauthAccessTokenTtlMinutes: Number(draft.oauthAccessTokenTtlMinutes),
                oauthRefreshTokenTtlDays: Number(draft.oauthRefreshTokenTtlDays),
              },
              {
                defaultSuccessMessage: "OAuth 设置已保存",
                defaultErrorMessage: "保存 OAuth 设置失败",
              },
            ),
          successTitle: "保存成功",
          errorTitle: "保存失败",
          refreshRouter: true,
        })
      }}
    >
      <SettingsSection
        title="OAuth 授权服务"
        description="集中控制 OAuth 2.0 授权服务、用户应用申请入口，以及 access_token / refresh_token 生命周期。"
        action={
          <Link href="/admin/settings/oauth/clients">
            <Button type="button" variant="outline">查看应用审核</Button>
          </Link>
        }
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <AdminBooleanSelectField
            label="开启 OAuth Server"
            checked={draft.oauthServerEnabled}
            onChange={(value) => updateDraft("oauthServerEnabled", value)}
            description="开启后，已审核应用可调用 /oauth/authorize、/oauth/token 和 /oauth/userinfo。"
          />
          <AdminBooleanSelectField
            label="允许用户申请 OAuth 应用"
            checked={draft.oauthClientApplicationEnabled}
            onChange={(value) => updateDraft("oauthClientApplicationEnabled", value)}
            description="关闭后，已有应用仍可继续工作，但用户不能提交新的应用申请。"
          />
          <TextField
            label="access_token 有效期（分钟）"
            type="number"
            min={5}
            max={1440}
            value={draft.oauthAccessTokenTtlMinutes}
            onChange={(value) => updateDraft("oauthAccessTokenTtlMinutes", value)}
            placeholder="如 60"
            description="取值范围 5-1440 分钟。"
          />
          <TextField
            label="refresh_token 有效期（天）"
            type="number"
            min={1}
            max={365}
            value={draft.oauthRefreshTokenTtlDays}
            onChange={(value) => updateDraft("oauthRefreshTokenTtlDays", value)}
            placeholder="如 30"
            description="取值范围 1-365 天。"
          />
        </div>
      </SettingsSection>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "保存中..." : "保存 OAuth 设置"}
        </Button>
        <span className="text-xs leading-6 text-muted-foreground">
          审核应用、重置 appid/key 请切换到“应用审核”。
        </span>
      </div>
    </form>
  )
}
