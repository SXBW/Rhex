import "server-only"

import path from "node:path"

import {
  ADDON_RUNTIME_LOG_DEDUPE_WINDOW_MS,
  createAddonLifecycleLog,
} from "@/db/addon-registry-queries"

import type {
  AddonUploadActor,
  AddonUploadPreparedFile,
  AddonUploadProviderRuntimeHooks,
  AddonUploadProviderTransformResult,
} from "@/addons-host/upload-types"
import {
  invokeAddonProviderRuntime,
  listAddonProviderRuntimeItems,
} from "@/lib/addon-provider-registry"
import type { SavedUploadFile } from "@/lib/upload"

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function normalizeOptionalString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback
}

function normalizeTransformBuffer(value: unknown) {
  if (!isRecord(value)) {
    return null
  }

  const buffer = value.buffer
  if (buffer instanceof Uint8Array && buffer.byteLength > 0) {
    return buffer
  }

  return null
}

const DEFAULT_UPLOAD_TRANSFORM_TIMEOUT_MS = 15_000
const MIN_UPLOAD_TRANSFORM_TIMEOUT_MS = 1_000
const MAX_UPLOAD_TRANSFORM_TIMEOUT_MS = 120_000
const DEFAULT_UPLOAD_TRANSFORM_SLOW_MS = 2_000

function readBoundedDurationEnv(name: string, fallback: number, minimum: number, maximum: number) {
  const value = Number.parseInt(process.env[name]?.trim() ?? "", 10)
  return Number.isFinite(value) && value > 0
    ? Math.min(maximum, Math.max(minimum, value))
    : fallback
}

async function recordUploadTransformLog(input: {
  addonId: string
  providerCode: string
  status: "FAILED" | "WARNING"
  message: string
  durationMs: number
  folder: string
}) {
  try {
    await createAddonLifecycleLog({
      addonId: input.addonId,
      action: "UPLOAD_TRANSFORM",
      status: input.status,
      message: input.message,
      dedupeWindowMs: ADDON_RUNTIME_LOG_DEDUPE_WINDOW_MS,
      metadataJson: {
        providerCode: input.providerCode,
        folder: input.folder,
      },
    })
    if (input.status === "WARNING") {
      console.warn(`[addon-upload] ${input.message}`, {
        addonId: input.addonId,
        providerCode: input.providerCode,
        durationMs: input.durationMs,
        folder: input.folder,
      })
    }
  } catch (error) {
    console.warn("[addon-upload] failed to record transform lifecycle log", error)
  }
}

async function invokeUploadTransformWithTimeout<T>(task: Promise<T>, timeoutMs: number, providerCode: string) {
  let timer: ReturnType<typeof setTimeout> | null = null

  try {
    return await Promise.race([
      task,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`图片处理插件 ${providerCode} 执行超时（${timeoutMs}ms）`))
        }, timeoutMs)
      }),
    ])
  } finally {
    if (timer) {
      clearTimeout(timer)
    }
  }
}

export async function transformWithAddonUploadProviders(input: {
  request?: Request
  actor?: AddonUploadActor | null
  file: File
  preparedFile: AddonUploadPreparedFile
  folder: string
  normalizeTransformedFile: (
    result: AddonUploadProviderTransformResult,
  ) => AddonUploadPreparedFile | Promise<AddonUploadPreparedFile>
}): Promise<AddonUploadPreparedFile> {
  const providers = await listAddonProviderRuntimeItems<AddonUploadProviderRuntimeHooks>(
    "upload",
    input.request ? { request: input.request } : undefined,
  )
  let preparedFile = input.preparedFile
  const timeoutMs = readBoundedDurationEnv(
    "ADDON_UPLOAD_TRANSFORM_TIMEOUT_MS",
    DEFAULT_UPLOAD_TRANSFORM_TIMEOUT_MS,
    MIN_UPLOAD_TRANSFORM_TIMEOUT_MS,
    MAX_UPLOAD_TRANSFORM_TIMEOUT_MS,
  )
  const slowMs = readBoundedDurationEnv(
    "ADDON_UPLOAD_TRANSFORM_SLOW_MS",
    DEFAULT_UPLOAD_TRANSFORM_SLOW_MS,
    100,
    MAX_UPLOAD_TRANSFORM_TIMEOUT_MS,
  )

  for (const item of providers) {
    const runtime = item.runtime
    if (typeof runtime?.transformFile !== "function") {
      continue
    }

    const startedAt = Date.now()
    let output

    try {
      output = await invokeUploadTransformWithTimeout(
        invokeAddonProviderRuntime(
          item,
          "transformFile",
          () => ({
            addon: item.addon,
            provider: item.provider,
            context: item.context,
            request: input.request,
            actor: input.actor,
            file: input.file,
            preparedFile,
            folder: input.folder,
          }),
        ),
        timeoutMs,
        item.provider.code,
      )
    } catch (error) {
      const durationMs = Date.now() - startedAt
      await recordUploadTransformLog({
        addonId: item.addon.manifest.id,
        providerCode: item.provider.code,
        status: "FAILED",
        message: error instanceof Error ? error.message : "图片处理插件执行失败",
        durationMs,
        folder: input.folder,
      })
      throw error
    }

    const durationMs = Date.now() - startedAt
    if (durationMs >= slowMs) {
      await recordUploadTransformLog({
        addonId: item.addon.manifest.id,
        providerCode: item.provider.code,
        status: "WARNING",
        message: `图片处理超过慢处理阈值 ${slowMs}ms`,
        durationMs,
        folder: input.folder,
      })
    }

    if (typeof output === "undefined" || output === null) {
      continue
    }

    const buffer = normalizeTransformBuffer(output)
    if (!buffer) {
      throw new Error(
        `addon upload provider "${item.provider.code}" returned an invalid transform result`,
      )
    }

    preparedFile = await input.normalizeTransformedFile({ buffer })
  }

  return preparedFile
}

function resolveFallbackFileName(urlPath: string, folder: string, preparedFile: AddonUploadPreparedFile, originalName: string) {
  const normalizedUrlPath = urlPath.replace(/\\/g, "/")
  const fromUrl = (() => {
    try {
      return path.posix.basename(new URL(normalizedUrlPath).pathname)
    } catch {
      return path.posix.basename(normalizedUrlPath)
    }
  })()
  const extension = path.extname(fromUrl || originalName || "") || ".bin"
  return fromUrl || `${folder}-${preparedFile.fileHash.slice(0, 16)}${extension}`
}

function normalizeAddonUploadResult(input: {
  value: unknown
  folder: string
  file: File
  preparedFile: AddonUploadPreparedFile
}): SavedUploadFile | null {
  if (!isRecord(input.value)) {
    return null
  }

  const urlPath = normalizeOptionalString(input.value.urlPath)
  if (!urlPath) {
    return null
  }

  const fileName = normalizeOptionalString(input.value.fileName)
    || resolveFallbackFileName(urlPath, input.folder, input.preparedFile, input.file.name)
  const fileExt = normalizeOptionalString(input.value.fileExt)
    || path.extname(fileName || input.file.name || "")
    || ".bin"

  return {
    fileName,
    storagePath: normalizeOptionalString(input.value.storagePath) || `remote:${urlPath}`,
    urlPath,
    fileExt,
    fileSize:
      typeof input.value.fileSize === "number" && Number.isFinite(input.value.fileSize) && input.value.fileSize > 0
        ? input.value.fileSize
        : input.preparedFile.fileSize,
    mimeType: normalizeOptionalString(input.value.mimeType) || input.preparedFile.detectedMime,
    fileHash: normalizeOptionalString(input.value.fileHash) || input.preparedFile.fileHash,
  }
}

export async function saveWithAddonUploadProvider(input: {
  request?: Request
  actor?: AddonUploadActor | null
  file: File
  preparedFile: AddonUploadPreparedFile
  folder: string
}): Promise<SavedUploadFile | null> {
  const providers = await listAddonProviderRuntimeItems<AddonUploadProviderRuntimeHooks>(
    "upload",
    input.request ? { request: input.request } : undefined,
  )

  for (const item of providers) {
    const runtime = item.runtime
    if (typeof runtime?.uploadFile !== "function") {
      continue
    }

    const output = await invokeAddonProviderRuntime(
      item,
      "uploadFile",
      () => ({
        addon: item.addon,
        provider: item.provider,
        context: item.context,
        request: input.request,
        actor: input.actor,
        file: input.file,
        preparedFile: input.preparedFile,
        folder: input.folder,
      }),
    )

    if (typeof output === "undefined" || output === null) {
      continue
    }

    const normalized = normalizeAddonUploadResult({
      value: output,
      folder: input.folder,
      file: input.file,
      preparedFile: input.preparedFile,
    })

    if (!normalized) {
      throw new Error(
        `addon upload provider "${item.provider.code}" returned an invalid upload result`,
      )
    }

    return normalized
  }

  return null
}
