import { promises as fs, existsSync } from "fs"
import path from "path"
import type { WorkflowNode, ExecutionContext, NodeExecutor } from "@/types/workflow"
import { resolveExpression } from "@/lib/expression"
import { getByPath } from "@/lib/json-path"
import { resolveCredentialValue } from "@/lib/credential"

function musicStorageDir(): string {
  return process.env.MUSIC_STORAGE_DIR || path.join(process.cwd(), "storage", "music")
}

function inferExt(contentType: string | null, url: string): string {
  const ct = (contentType || "").toLowerCase()
  if (ct.includes("mpeg") || ct.includes("mp3")) return "mp3"
  if (ct.includes("wav")) return "wav"
  if (ct.includes("ogg")) return "ogg"
  if (ct.includes("mp4") || ct.includes("m4a")) return "m4a"
  if (ct.includes("flac")) return "flac"
  if (ct.includes("aac")) return "aac"
  const m = url.match(/\.(mp3|wav|ogg|m4a|flac|aac)(\?|$)/i)
  if (m) return m[1].toLowerCase()
  return "mp3"
}

async function sleep(ms: number) { await new Promise((r) => setTimeout(r, ms)) }

export const executeMusicNode: NodeExecutor = async (node, context) => {
  const config = (node.data.config as Record<string, unknown>) || {}
  const method = (config.method as string) || "POST"
  const headers: Record<string, string> = { ...((config.headers as Record<string, string>) || {}) }
  const auth = (config.auth as string) || "none"
  const authToken = (config.authToken as string) || ""
  const credentialId = (config.credentialId as string) || ""

  const url = resolveExpression((config.apiUrl as string) || "", context)
  if (!url) throw new Error("Music API URL is not configured")

  const body = method !== "GET" ? resolveExpression((config.bodyTemplate as string) || "", context) : ""

  // 凭证优先：credentialId 非空时从数据库读取解密值作为 token
  let effectiveToken = authToken
  let tokenFromCredential = false
  if (credentialId && (auth === "bearer" || auth === "api_key")) {
    const credValue = await resolveCredentialValue(credentialId)
    if (!credValue) throw new Error(`Credential not found: ${credentialId}`)
    effectiveToken = credValue
    tokenFromCredential = true
  }

  if (auth === "bearer" && effectiveToken) {
    const token = tokenFromCredential ? effectiveToken : resolveExpression(effectiveToken, context)
    headers["Authorization"] = `Bearer ${token}`
  } else if (auth === "api_key" && effectiveToken) {
    const token = tokenFromCredential ? effectiveToken : resolveExpression(effectiveToken, context)
    headers["X-API-Key"] = token
  }

  const init: RequestInit = { method, headers }
  if (method !== "GET" && body) init.body = body

  const firstRes = await fetch(url, init)
  if (!firstRes.ok) throw new Error(`Music API request failed: ${firstRes.status}`)
  const firstText = await firstRes.text()
  let firstJson: unknown
  try { firstJson = JSON.parse(firstText) } catch { firstJson = { raw: firstText } }

  const pollingEnabled = Boolean(config.pollingEnabled)
  const taskIdField = (config.taskIdField as string) || ""
  const pollUrlTemplate = (config.pollUrlTemplate as string) || ""
  const pollIntervalMs = (config.pollIntervalMs as number) ?? 3000
  const pollMaxAttempts = (config.pollMaxAttempts as number) ?? 60
  const pollStatusField = (config.pollStatusField as string) || ""
  const pollSuccessValue = (config.pollSuccessValue as string) || ""
  const audioUrlField = (config.audioUrlField as string) || ""
  const metadataField = (config.metadataField as string) || ""

  let finalResp: unknown = firstJson

  if (pollingEnabled) {
    const taskId = String(getByPath(firstJson, taskIdField) ?? "")
    if (!taskId) throw new Error(`Polling enabled but taskId not found at path: ${taskIdField}`)
    const pollUrl = pollUrlTemplate.replace("{{taskId}}", taskId)
    for (let i = 0; i < pollMaxAttempts; i++) {
      await sleep(pollIntervalMs)
      const r = await fetch(pollUrl, { method: "GET", headers })
      if (!r.ok) throw new Error(`Music polling request failed: ${r.status}`)
      const t = await r.text()
      try { finalResp = JSON.parse(t) } catch { finalResp = { raw: t } }
      if (pollStatusField && pollSuccessValue) {
        if (String(getByPath(finalResp, pollStatusField) ?? "") === pollSuccessValue) break
      } else {
        if (getByPath(finalResp, audioUrlField)) break
      }
      if (i === pollMaxAttempts - 1) throw new Error("Music generation polling timed out")
    }
  }

  const remoteAudioUrl = String(getByPath(finalResp, audioUrlField) ?? "")
  if (!remoteAudioUrl) throw new Error(`Audio URL not found at path "${audioUrlField}" in response`)
  const metaVal = metadataField ? getByPath(finalResp, metadataField) : undefined
  const metadata = (metaVal && typeof metaVal === "object") ? metaVal as Record<string, unknown> : {}

  const audioRes = await fetch(remoteAudioUrl)
  if (!audioRes.ok) throw new Error(`Failed to download audio: ${audioRes.status}`)
  const contentType = audioRes.headers.get("content-type")
  const ext = inferExt(contentType, remoteAudioUrl)
  const buf = Buffer.from(await audioRes.arrayBuffer())

  const dir = musicStorageDir()
  if (!existsSync(dir)) await fs.mkdir(dir, { recursive: true })
  const fileName = `${context.executionId}_${node.id}.${ext}`
  const localPath = path.join(dir, fileName)
  await fs.writeFile(localPath, buf)

  const audioUrl = `/api/music/file?executionId=${encodeURIComponent(context.executionId)}&nodeId=${encodeURIComponent(node.id)}`
  return {
    audioUrl,
    localPath,
    fileName,
    metadata,
    raw: JSON.stringify(finalResp),
  }
}