import { promises as fs } from "fs"
import path from "path"
import type { WorkflowNode, ExecutionContext, NodeExecutor } from "@/types/workflow"

function exportBaseDir(): string {
  return process.env.EXPORT_STORAGE_DIR || path.join(process.cwd(), "storage", "exports")
}

/** 扩展名按输出格式映射 */
function extFor(format: string): string {
  switch (format) {
    case "markdown": return "md"
    case "json": return "json"
    default: return "txt"
  }
}

/** output-YYYYMMDD-HHmmss.<ext>；已存在同名时追加毫秒避让 */
async function uniqueExportName(dir: string, ext: string): Promise<string> {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, "0")
  const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  let name = `output-${stamp}.${ext}`
  try {
    await fs.access(path.join(dir, name))
    name = `output-${stamp}-${d.getMilliseconds()}.${ext}`
  } catch { /* 不存在 → 使用默认名 */ }
  return name
}

/**
 * 校验并解析导出目录（spec：本地保存路径校验）：
 * - 空 → 基础导出目录
 * - 相对路径 → 锚定在基础目录下，禁止 .. 逃逸基础目录
 * - 绝对路径 → 视为用户显式指定，直接使用
 */
function resolveExportDir(exportPath: string): string {
  const base = exportBaseDir()
  if (!exportPath || !exportPath.trim()) return base
  if (path.isAbsolute(exportPath)) return path.normalize(exportPath)
  const resolved = path.resolve(base, exportPath)
  const rel = path.relative(base, resolved)
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`Invalid exportPath "${exportPath}": relative paths cannot escape the export base directory`)
  }
  return resolved
}

interface MusicResult {
  audioUrl: string
  localPath: string
  fileName: string
  metadata: Record<string, unknown>
}

/**
 * Scans all nodeResults for a music-shaped result. Like the existing raw
 * aggregation, this does NOT resolve actual graph predecessors (executor
 * context has no edge info) — it picks the first music result in execution
 * order. In branching workflows with multiple music nodes this may pick a
 * non-predecessor; acceptable given the existing executor design.
 */
function findUpstreamMusic(context: ExecutionContext): MusicResult | null {
  for (const [, output] of context.nodeResults) {
    if (output && typeof output === "object" && "audioUrl" in (output as Record<string, unknown>)) {
      const r = output as Record<string, unknown>
      if (typeof r.audioUrl === "string" && typeof r.localPath === "string") {
        return {
          audioUrl: r.audioUrl,
          localPath: r.localPath,
          fileName: (r.fileName as string) || path.basename(r.localPath),
          metadata: (r.metadata as Record<string, unknown>) || {},
        }
      }
    }
  }
  return null
}

export const executeOutputNode: NodeExecutor = async (node, context) => {
  const config = (node.data.config as Record<string, unknown>) || {}
  const format = (config.format as string) || "text"
  const template = (config.template as string) || ""

  const previousOutputs: string[] = []
  for (const [, output] of context.nodeResults) {
    if (typeof output === "object" && output !== null) {
      const obj = output as Record<string, unknown>
      if (obj.raw && typeof obj.raw === "string") {
        previousOutputs.push(obj.raw)
      }
    } else if (typeof output === "string") {
      previousOutputs.push(output)
    }
  }

  let output: unknown

  switch (format) {
    case "json":
      try {
        output = JSON.parse(previousOutputs.join(""))
      } catch {
        output = previousOutputs
      }
      break
    case "markdown":
      output = previousOutputs.join("\n\n---\n\n")
      break
    case "text":
    default:
      output = previousOutputs.join("\n\n")
      break
  }

  if (template) {
    let formatted = template
    for (const [nodeId, result] of context.nodeResults) {
      if (typeof result === "object" && result !== null) {
        const obj = result as Record<string, unknown>
        if (typeof obj.raw === "string") {
          formatted = formatted.replace(`{{${nodeId}}}`, obj.raw)
        }
      }
    }
    output = formatted
  }

  const music = findUpstreamMusic(context)
  const exportMode = (config.exportMode as string) || "download"

  if (music) {
    if (exportMode === "local") {
      const dir = resolveExportDir((config.exportPath as string) || "")
      await fs.mkdir(dir, { recursive: true })
      await fs.copyFile(music.localPath, path.join(dir, music.fileName))
    } else if (exportMode === "remote") {
      const remoteUrl = (config.remoteUrl as string) || ""
      if (!remoteUrl) throw new Error("Export mode is remote but remoteUrl is empty")
      const fileBuf = await fs.readFile(music.localPath)
      const ext = path.extname(music.fileName).replace(".", "")
      const mime = ext === "wav" ? "audio/wav" : ext === "ogg" ? "audio/ogg" : ext === "m4a" ? "audio/mp4" : "audio/mpeg"
      const form = new FormData()
      form.append("file", new Blob([fileBuf], { type: mime }), music.fileName)
      const res = await fetch(remoteUrl, { method: "POST", body: form })
      if (!res.ok) throw new Error(`Remote upload failed: ${res.status}`)
    }
    return {
      output,
      raw: typeof output === "string" ? output : JSON.stringify(output),
      format,
      audioUrl: music.audioUrl,
      fileName: music.fileName,
      metadata: music.metadata,
    }
  }

  // ===== 文本产物导出（Phase 3 报告链路）：命名规则 + 本地落盘 =====
  const raw = typeof output === "string" ? output : JSON.stringify(output)
  let fileName: string | undefined
  let localPath: string | undefined

  if (!music && exportMode === "local") {
    const dir = resolveExportDir((config.exportPath as string) || "")
    await fs.mkdir(dir, { recursive: true })
    fileName = await uniqueExportName(dir, extFor(format))
    localPath = path.join(dir, fileName)
    await fs.writeFile(localPath, raw)
  } else if (!music && exportMode === "download") {
    // download 模式也给出统一命名，供前端保存时使用
    const d = new Date()
    const p = (n: number) => String(n).padStart(2, "0")
    fileName = `output-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.${extFor(format)}`
  }

  return {
    output,
    raw,
    format,
    ...(fileName ? { fileName } : {}),
    ...(localPath ? { localPath } : {}),
  }
}
