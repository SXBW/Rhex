import type { AdminSettingsSectionKey } from "@/lib/admin-navigation"
import type {
  AdminBasicSettingsDraft,
  AdminBasicSettingsInitialSettings,
} from "@/components/admin/admin-site-settings.shared"

export type { AdminBasicSettingsDraft } from "@/components/admin/admin-site-settings.shared"

export type AdminBasicSettingsMode =
  | "profile"
  | "registration"
  | "interaction"
  | "board-applications"

export interface AdminBasicSettingsInviteCodeItem {
  id: string
  code: string
  createdAt: string
  createdByUsername: string | null
  isUsed: boolean
  usedAt: string | null
  usedByUsername: string | null
  note: string | null
}

export interface AdminBasicSettingsInviteCodePageData {
  items: AdminBasicSettingsInviteCodeItem[]
  status: "all" | "used" | "unused"
  summary: {
    total: number
    used: number
    unused: number
    manual: number
  }
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
    hasPrevPage: boolean
    hasNextPage: boolean
  }
}

export interface AdminBasicSettingsFormProps {
  initialSettings: AdminBasicSettingsInitialSettings
  mode?: AdminBasicSettingsMode
  initialSubTab?: string
  subTabRouteSection?: AdminSettingsSectionKey
  initialInviteCodePage?: AdminBasicSettingsInviteCodePageData
}

export type UpdateAdminBasicSettingsDraftField = <Key extends keyof AdminBasicSettingsDraft>(
  field: Key,
  value: AdminBasicSettingsDraft[Key],
) => void

interface AdminBasicSettingsModeProps {
  activeSubTab: string
  draft: AdminBasicSettingsDraft
  updateDraftField: UpdateAdminBasicSettingsDraftField
}

export interface AdminRegistrationSettingsFormProps
  extends AdminBasicSettingsModeProps {
  initialInviteCodePage?: AdminBasicSettingsInviteCodePageData
}

export type AdminProfileSettingsFormProps = AdminBasicSettingsModeProps

export type AdminInteractionSettingsFormProps = AdminBasicSettingsModeProps

export type AdminBoardApplicationSettingsFormProps = AdminBasicSettingsModeProps
