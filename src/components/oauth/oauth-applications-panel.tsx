"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, Copy, KeyRound, Plus, RotateCcw } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { FormModal, Modal } from "@/components/ui/modal"
import { Input } from "@/components/ui/input"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { formatDateTime } from "@/lib/formatters"
import type { OAuthAuthorizedSiteListItem, OAuthClientListItem } from "@/lib/oauth-server"

interface OAuthApplicationsPanelProps {
  enabled: boolean
  oauthServerEnabled: boolean
  oauthClientApplicationEnabled: boolean
  clients: OAuthClientListItem[]
  authorizedSites: OAuthAuthorizedSiteListItem[]
}

interface OAuthClientFormState {
  id?: string
  name: string
  description: string
  homepageUrl: string
  logoUrl: string
  redirectUris: string
  scopes: string[]
}

const scopeOptions = [
  { value: "openid", label: "openid", description: "OAuth/OIDC 基础身份标识，默认必须包含。" },
  { value: "profile", label: "profile", description: "读取用户名、昵称、头像等公开资料。" },
  { value: "email", label: "email", description: "读取邮箱和邮箱验证状态。" },
]

const oauthEndpointRows = [
  { label: "授权地址", value: "GET /oauth/authorize" },
  { label: "Token 地址", value: "POST /oauth/token" },
  { label: "用户信息", value: "GET /oauth/userinfo" },
  { label: "撤销 Token", value: "POST /oauth/revoke" },
]

const authorizationParameterRows = [
  { name: "client_id", description: "应用 appid。" },
  { name: "redirect_uri", description: "必须与应用配置中的回调地址完全一致。" },
  { name: "response_type", description: "固定传 code。" },
  { name: "scope", description: "用空格分隔，例如 openid profile email。" },
  { name: "state", description: "建议必传，用于回调后校验请求来源。" },
  { name: "code_challenge", description: "由 code_verifier 生成的 SHA-256 Base64URL 摘要。" },
  { name: "code_challenge_method", description: "固定传 S256。" },
]

const tokenParameterRows = [
  { name: "grant_type", description: "授权码模式固定传 authorization_code。" },
  { name: "code", description: "授权回调得到的一次性授权码。" },
  { name: "redirect_uri", description: "必须与发起授权时的 redirect_uri 一致。" },
  { name: "code_verifier", description: "发起授权前生成并保存在客户端会话中的 PKCE verifier。" },
  { name: "client_id / client_secret", description: "推荐使用 HTTP Basic 认证，也支持表单字段传入。" },
]

function getInitialForm(client?: OAuthClientListItem | null): OAuthClientFormState {
  return {
    id: client?.id,
    name: client?.name ?? "",
    description: client?.description ?? "",
    homepageUrl: client?.homepageUrl ?? "",
    logoUrl: client?.logoUrl ?? "",
    redirectUris: client?.redirectUris.join("\n") ?? "",
    scopes: client?.scopes.length ? client.scopes : ["openid", "profile", "email"],
  }
}

export function OAuthApplicationsPanel({
  enabled,
  oauthServerEnabled,
  oauthClientApplicationEnabled,
  clients,
  authorizedSites,
}: OAuthApplicationsPanelProps) {
  const router = useRouter()
  const [editingClient, setEditingClient] = useState<OAuthClientListItem | null>(null)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [secretModal, setSecretModal] = useState<{ clientId: string; clientSecret: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  function openCreateModal() {
    setEditingClient(null)
    setCreateModalOpen(true)
  }

  function openEditModal(client: OAuthClientListItem) {
    setEditingClient(client)
    setCreateModalOpen(true)
  }

  function closeFormModal() {
    if (isPending) {
      return
    }

    setCreateModalOpen(false)
    setEditingClient(null)
  }

  function resetSecret(client: OAuthClientListItem) {
    startTransition(async () => {
      try {
        const response = await fetch("/api/oauth/clients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "rotate-secret",
            id: client.id,
          }),
        })
        const result = await response.json().catch(() => null)

        if (!response.ok || result?.code !== 0) {
          throw new Error(result?.message ?? "重置密钥失败")
        }

        setSecretModal({
          clientId: client.clientId,
          clientSecret: String(result.data?.clientSecret ?? ""),
        })
        toast.success("应用密钥已重置", "OAuth 应用")
        router.refresh()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "重置密钥失败", "OAuth 应用")
      }
    })
  }

  function revokeConsent(site: OAuthAuthorizedSiteListItem) {
    startTransition(async () => {
      try {
        const response = await fetch("/api/oauth/authorized-sites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "revoke",
            clientId: site.clientId,
          }),
        })
        const result = await response.json().catch(() => null)

        if (!response.ok || result?.code !== 0) {
          throw new Error(result?.message ?? "取消授权失败")
        }

        toast.success("已取消授权", "OAuth 授权")
        router.refresh()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "取消授权失败", "OAuth 授权")
      }
    })
  }

  const disabledReason = !oauthServerEnabled
    ? "站点 OAuth 授权服务未开启，当前无法申请应用。"
    : !oauthClientApplicationEnabled
      ? "后台已关闭用户申请 OAuth 应用入口。"
      : ""

  return (
    <div className="flex w-full flex-col gap-4">
      <Tabs defaultValue="apps" className="flex w-full flex-col gap-4">
        <TabsList className="self-start">
          <TabsTrigger value="apps">我的应用</TabsTrigger>
          <TabsTrigger value="authorized">我授权的站点</TabsTrigger>
          <TabsTrigger value="docs">接入文档</TabsTrigger>
        </TabsList>

        <TabsContent value="apps" className="w-full">
          <OAuthClientAppsCard
            enabled={enabled}
            disabledReason={disabledReason}
            clients={clients}
            isPending={isPending}
            onCreate={openCreateModal}
            onEdit={openEditModal}
            onResetSecret={resetSecret}
          />
        </TabsContent>

        <TabsContent value="authorized" className="w-full">
          <AuthorizedSitesCard
            sites={authorizedSites}
            isPending={isPending}
            onRevoke={revokeConsent}
          />
        </TabsContent>

        <TabsContent value="docs" className="w-full">
          <OAuthIntegrationDocs />
        </TabsContent>
      </Tabs>

      <OAuthClientFormModal
        key={editingClient?.id ?? "new-oauth-client"}
        open={createModalOpen}
        client={editingClient}
        isPending={isPending}
        onClose={closeFormModal}
        onSecret={(payload) => setSecretModal(payload)}
        startTransition={startTransition}
      />

      <SecretOnceModal secret={secretModal} onClose={() => setSecretModal(null)} />
    </div>
  )
}

function OAuthClientAppsCard({
  enabled,
  disabledReason,
  clients,
  isPending,
  onCreate,
  onEdit,
  onResetSecret,
}: {
  enabled: boolean
  disabledReason: string
  clients: OAuthClientListItem[]
  isPending: boolean
  onCreate: () => void
  onEdit: (client: OAuthClientListItem) => void
  onResetSecret: (client: OAuthClientListItem) => void
}) {
  return (
    <Card>
      <CardHeader className="border-b">
        <div>
          <CardTitle>开发者应用</CardTitle>
          <CardDescription>申请 OAuth 2.0 应用，审核通过后可使用 Authorization Code + PKCE 接入本站账号授权。</CardDescription>
        </div>
        <CardAction>
          <Button type="button" disabled={!enabled} onClick={onCreate}>
            <Plus data-icon="inline-start" />
            申请应用
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 py-4">
        {disabledReason ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            {disabledReason}
          </div>
        ) : null}

        {clients.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
            <p className="text-sm font-medium">还没有 OAuth 应用</p>
            <p className="mt-2 text-sm text-muted-foreground">申请后等待管理员审核，通过后即可获取 appid/key 并接入授权流程。</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {clients.map((client) => (
              <article key={client.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold">{client.name}</h3>
                      <OAuthClientStatusBadge status={client.status} />
                    </div>
                    <p className="mt-2 break-all text-xs text-muted-foreground">appid: <code>{client.clientId}</code></p>
                    {client.description ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{client.description}</p> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(client.status === "PENDING" || client.status === "REJECTED") && enabled ? (
                      <Button type="button" variant="outline" onClick={() => onEdit(client)}>
                        修改后重提
                      </Button>
                    ) : null}
                    <Button type="button" variant="outline" disabled={isPending} onClick={() => onResetSecret(client)}>
                      <RotateCcw data-icon="inline-start" />
                      重置 key
                    </Button>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 text-xs text-muted-foreground lg:grid-cols-3">
                  <div className="rounded-[16px] bg-muted/35 px-3 py-2">
                    <p className="font-medium text-foreground">回调地址</p>
                    <div className="mt-2 flex flex-col gap-1">
                      {client.redirectUris.map((uri) => <code key={uri} className="break-all">{uri}</code>)}
                    </div>
                  </div>
                  <div className="rounded-[16px] bg-muted/35 px-3 py-2">
                    <p className="font-medium text-foreground">权限范围</p>
                    <p className="mt-2">{client.scopes.join(" ")}</p>
                  </div>
                  <div className="rounded-[16px] bg-muted/35 px-3 py-2">
                    <p className="font-medium text-foreground">审核状态</p>
                    <p className="mt-2">创建：{formatDateTime(client.createdAt)}</p>
                    <p className="mt-1">审核：{client.reviewedAt ? formatDateTime(client.reviewedAt) : "待处理"}</p>
                    <p className="mt-1">key：{client.secretRotatedAt ? `重置于 ${formatDateTime(client.secretRotatedAt)}` : "创建时生成"}</p>
                  </div>
                </div>

                {client.reviewNote ? (
                  <div className="mt-3 rounded-[16px] border border-dashed border-border bg-background px-3 py-2 text-sm text-muted-foreground">
                    审核备注：{client.reviewNote}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function AuthorizedSitesCard({
  sites,
  isPending,
  onRevoke,
}: {
  sites: OAuthAuthorizedSiteListItem[]
  isPending: boolean
  onRevoke: (site: OAuthAuthorizedSiteListItem) => void
}) {
  return (
    <Card>
      <CardHeader className="border-b">
        <div>
          <CardTitle>我授权的站点</CardTitle>
          <CardDescription>查看已经允许使用你账号登录的 OAuth 应用，可随时取消授权并撤销当前 token。</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 py-4">
        {sites.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
            <p className="text-sm font-medium">还没有授权过第三方站点</p>
            <p className="mt-2 text-sm text-muted-foreground">当你在授权页点击同意后，应用会出现在这里。</p>
          </div>
        ) : (
          sites.map((site) => (
            <article key={site.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold">{site.name}</h3>
                    <OAuthClientStatusBadge status={site.status} />
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    授权范围：<code>{site.scopes.join(" ")}</code>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    首次授权：{formatDateTime(site.authorizedAt)} · 最近更新：{formatDateTime(site.updatedAt)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    当前有效 access token：{site.activeAccessTokenCount}，refresh token：{site.activeRefreshTokenCount}
                  </p>
                  {site.homepageUrl ? (
                    <p className="mt-2 break-all text-xs text-muted-foreground">主页：{site.homepageUrl}</p>
                  ) : null}
                </div>
                <Button type="button" variant="outline" disabled={isPending} onClick={() => onRevoke(site)}>
                  取消授权
                </Button>
              </div>
            </article>
          ))
        )}
      </CardContent>
    </Card>
  )
}

function OAuthIntegrationDocs() {
  return (
    <Card>
      <CardHeader className="border-b">
        <div>
          <CardTitle>接入文档</CardTitle>
          <CardDescription>本站 OAuth Server 使用 Authorization Code + PKCE。应用审核通过后，用 appid/key 接入完整登录流程。</CardDescription>
        </div>
        <CardAction>
          <Badge variant="secondary">PKCE S256</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-5 py-4">
        <section className="grid gap-3 md:grid-cols-2">
          {oauthEndpointRows.map((item) => (
            <div key={item.label} className="rounded-xl border border-border bg-muted/25 px-4 py-3">
              <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
              <code className="mt-2 block break-all text-sm">{item.value}</code>
            </div>
          ))}
        </section>

        <section className="flex flex-col gap-3">
          <div>
            <h3 className="text-sm font-semibold">最小流程</h3>
            <p className="mt-1 text-sm text-muted-foreground">先生成 PKCE，再跳转授权页，回调拿 code 后换 token，最后用 access_token 读取用户信息。</p>
          </div>
          <ol className="grid gap-2 text-sm text-muted-foreground">
            <li className="rounded-xl border border-border px-4 py-3">生成随机 code_verifier，并计算 code_challenge = base64url(sha256(code_verifier))。</li>
            <li className="rounded-xl border border-border px-4 py-3">跳转到 /oauth/authorize，请求参数包含 client_id、redirect_uri、response_type=code、scope、state、code_challenge、code_challenge_method=S256。</li>
            <li className="rounded-xl border border-border px-4 py-3">用户同意授权后，本站回调 redirect_uri，并携带 code 和 state。</li>
            <li className="rounded-xl border border-border px-4 py-3">服务端 POST /oauth/token，用 code、redirect_uri、code_verifier 和 client_secret 换取 access_token。</li>
            <li className="rounded-xl border border-border px-4 py-3">请求 /oauth/userinfo 时传 Authorization: Bearer access_token。</li>
          </ol>
        </section>

        <div className="grid gap-3 xl:grid-cols-2">
          <ParameterReference title="授权请求参数" rows={authorizationParameterRows} />
          <ParameterReference title="Token 请求参数" rows={tokenParameterRows} />
        </div>

        <section className="rounded-xl border border-dashed border-border bg-muted/25 px-4 py-3">
          <h3 className="text-sm font-semibold">示例授权地址</h3>
          <code className="mt-3 block break-all text-xs leading-6 text-muted-foreground">
            /oauth/authorize?client_id=你的appid&amp;redirect_uri=http%3A%2F%2Flocalhost%3A8787%2Fcallback&amp;response_type=code&amp;scope=openid%20profile%20email&amp;state=随机state&amp;code_challenge=PKCE摘要&amp;code_challenge_method=S256
          </code>
          <p className="mt-3 text-xs leading-6 text-muted-foreground">
            回调地址必须与应用配置完全一致。生产环境建议使用 https；本地演示可使用 localhost 或 127.0.0.1。
          </p>
        </section>
      </CardContent>
    </Card>
  )
}

function ParameterReference({
  title,
  rows,
}: {
  title: string
  rows: Array<{ name: string; description: string }>
}) {
  return (
    <section className="rounded-xl border border-border">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className="divide-y divide-border">
        {rows.map((row) => (
          <div key={row.name} className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[180px_minmax(0,1fr)]">
            <code className="break-all text-foreground">{row.name}</code>
            <p className="leading-6 text-muted-foreground">{row.description}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function OAuthClientFormModal({
  open,
  client,
  isPending,
  onClose,
  onSecret,
  startTransition,
}: {
  open: boolean
  client: OAuthClientListItem | null
  isPending: boolean
  onClose: () => void
  onSecret: (payload: { clientId: string; clientSecret: string }) => void
  startTransition: ReturnType<typeof useTransition>[1]
}) {
  const router = useRouter()
  const [form, setForm] = useState<OAuthClientFormState>(() => getInitialForm(client))

  if (!open) {
    return null
  }

  function updateForm<K extends keyof OAuthClientFormState>(key: K, value: OAuthClientFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function toggleScope(scope: string, checked: boolean) {
    setForm((current) => {
      const next = checked
        ? Array.from(new Set([...current.scopes, scope]))
        : current.scopes.filter((item) => item !== scope)

      return {
        ...current,
        scopes: next.includes("openid") ? next : ["openid", ...next],
      }
    })
  }

  function submit() {
    startTransition(async () => {
      try {
        const response = await fetch("/api/oauth/clients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: client ? "update" : "create",
            id: client?.id,
            name: form.name,
            description: form.description,
            homepageUrl: form.homepageUrl,
            logoUrl: form.logoUrl,
            redirectUris: form.redirectUris,
            scopes: form.scopes,
          }),
        })
        const result = await response.json().catch(() => null)

        if (!response.ok || result?.code !== 0) {
          throw new Error(result?.message ?? "提交 OAuth 应用失败")
        }

        toast.success(client ? "OAuth 应用已重新提交审核" : "OAuth 应用申请已提交", "OAuth 应用")
        if (!client) {
          onSecret({
            clientId: String(result.data?.client?.clientId ?? ""),
            clientSecret: String(result.data?.clientSecret ?? ""),
          })
        }
        router.refresh()
        onClose()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "提交 OAuth 应用失败", "OAuth 应用")
      }
    })
  }

  return (
    <FormModal
      open
      title={client ? "修改 OAuth 应用" : "申请 OAuth 应用"}
      description="回调地址必须精确匹配。生产环境仅允许 https，本地开发允许 localhost / 127.0.0.1。"
      size="lg"
      closeDisabled={isPending}
      closeOnEscape={!isPending}
      onClose={onClose}
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
      footer={({ formId }) => (
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" disabled={isPending} onClick={onClose}>取消</Button>
          <Button type="submit" form={formId} disabled={isPending}>{isPending ? "提交中..." : "提交审核"}</Button>
        </div>
      )}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">应用名称 *</span>
          <Input value={form.name} onChange={(event) => updateForm("name", event.target.value)} placeholder="例如 我的社区登录" required />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">应用主页</span>
          <Input value={form.homepageUrl} onChange={(event) => updateForm("homepageUrl", event.target.value)} placeholder="https://example.com" />
        </label>
      </div>
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">应用描述</span>
        <Textarea value={form.description} onChange={(event) => updateForm("description", event.target.value)} rows={4} placeholder="说明应用用途，方便管理员审核。" />
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">Logo 地址</span>
        <Input value={form.logoUrl} onChange={(event) => updateForm("logoUrl", event.target.value)} placeholder="https://example.com/logo.png" />
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">回调地址 *</span>
        <Textarea value={form.redirectUris} onChange={(event) => updateForm("redirectUris", event.target.value)} rows={5} placeholder={"每行一个，例如\nhttps://example.com/auth/callback\nhttp://localhost:3000/auth/callback"} required />
        <span className="text-xs text-muted-foreground">授权时传入的 redirect_uri 必须与这里其中一项完全一致。</span>
      </label>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">权限范围</span>
        <div className="grid gap-2">
          {scopeOptions.map((scope) => (
            <label key={scope.value} className="flex items-start gap-3 rounded-xl border border-border px-3 py-2">
              <input
                type="checkbox"
                checked={form.scopes.includes(scope.value)}
                disabled={scope.value === "openid"}
                onChange={(event) => toggleScope(scope.value, event.target.checked)}
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-medium">{scope.label}</span>
                <span className="text-xs leading-5 text-muted-foreground">{scope.description}</span>
              </span>
            </label>
          ))}
        </div>
      </div>
    </FormModal>
  )
}

function SecretOnceModal({
  secret,
  onClose,
}: {
  secret: { clientId: string; clientSecret: string } | null
  onClose: () => void
}) {
  if (!secret) {
    return null
  }

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(`${label} 已复制`, "OAuth 应用")
    } catch {
      toast.error("复制失败，请手动复制", "OAuth 应用")
    }
  }

  return (
    <Modal
      open
      title="请保存应用密钥"
      description="client_secret 只会显示这一次。关闭弹窗后无法再次查看，只能重置生成新密钥。"
      size="md"
      onClose={onClose}
      footer={(
        <div className="flex justify-end">
          <Button type="button" onClick={onClose}>我已保存</Button>
        </div>
      )}
    >
      <div className="flex flex-col gap-3">
        <SecretRow label="appid / client_id" value={secret.clientId} onCopy={() => copy(secret.clientId, "client_id")} />
        <SecretRow label="key / client_secret" value={secret.clientSecret} onCopy={() => copy(secret.clientSecret, "client_secret")} />
        <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-xs leading-6 text-amber-800">
          请把 key 存到你的服务端环境变量中，不要提交到前端代码或公开仓库。
        </div>
      </div>
    </Modal>
  )
}

function SecretRow({ label, value, onCopy }: { label: string; value: string; onCopy: () => void }) {
  return (
    <div className="rounded-xl border border-border bg-muted/25 px-3 py-2">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Button type="button" variant="outline" size="sm" onClick={onCopy}>
          <Copy data-icon="inline-start" />
          复制
        </Button>
      </div>
      <code className="block break-all text-sm">{value}</code>
    </div>
  )
}

function OAuthClientStatusBadge({ status }: { status: OAuthClientListItem["status"] }) {
  if (status === "APPROVED") {
    return (
      <Badge className="border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">
        <CheckCircle2 data-icon="inline-start" />
        已通过
      </Badge>
    )
  }

  if (status === "REJECTED") {
    return <Badge className="border-transparent bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200">已驳回</Badge>
  }

  if (status === "DISABLED") {
    return <Badge className="border-transparent bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-200">已禁用</Badge>
  }

  return (
    <Badge className="border-transparent bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">
      <KeyRound data-icon="inline-start" />
      待审核
    </Badge>
  )
}
