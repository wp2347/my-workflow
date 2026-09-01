import { promises as fs } from "fs"
import path from "path"
import type { ExecutionContext, NodeExecutor } from "@/types/workflow"
import { officeOutputToStorageRel, STORAGE_ROOT } from "@/lib/storage-path"
import { resolveExpression } from "@/lib/expression"

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

const OFFICE_TOOLS = new Set(["create_docx", "create_xlsx", "create_pptx", "create_pdf"])

interface GeneratedFile {
  filePath: string  // storage 相对路径
  fileName: string
  fileSize?: number
}

/**
 * 扫描上游 LLM 节点的工具调用，提取 office 工具生成的产物文件。
 * LLM 节点输出含 toolCalls: [{ name, args: { outputPath } }]，
 * outputPath 即 office 工具写入的文件（相对 cwd 或 storage 根内绝对路径）。
 */
function findUpstreamGeneratedFile(context: ExecutionContext): GeneratedFile | null {
  for (const [, output] of context.nodeResults) {
    if (!output || typeof output !== "object") continue
    const obj = output as Record<string, unknown>
    const calls = obj.toolCalls
    if (!Array.isArray(calls)) continue
    for (const call of calls) {
      const c = call as Record<string, unknown> | null
      if (!c || typeof c !== "object") continue
      const name = c.name as string | undefined
      if (!name || !OFFICE_TOOLS.has(name)) continue
      const args = c.args as Record<string, unknown> | undefined
      const rel = officeOutputToStorageRel(args?.outputPath)
      if (!rel) continue
      return {
        filePath: rel,
        fileName: path.basename(rel),
        fileSize: undefined,
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
    // 支持 {{ $node.llm-1.text }} / {{ llm-1.text }} / {{ field }} 等表达式语法
    output = resolveExpression(template, context)
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
  let filePath: string | undefined // storage 根相对路径（供下载/删除 API）
  let fileSize: number | undefined

  if (!music && exportMode === "local") {
    const dir = resolveExportDir((config.exportPath as string) || "")
    await fs.mkdir(dir, { recursive: true })
    fileName = await uniqueExportName(dir, extFor(format))
    localPath = path.join(dir, fileName)
    await fs.writeFile(localPath, raw)
    try {
      const stat = await fs.stat(localPath)
      fileSize = stat.size
    } catch {
      /* ignore */
    }
    // 计算 storage 根相对路径；文件若在 storage 外则无法通过 storage API 下载
    const storageRoot = process.env.STORAGE_DIR || path.join(process.cwd(), "storage")
    const rel = path.relative(storageRoot, localPath)
    if (rel && !rel.startsWith("..") && !path.isAbsolute(rel)) {
      filePath = rel.split(path.sep).join("/")
    }
  } else if (!music && exportMode === "download") {
    // download 模式也给出统一命名，供前端保存时使用
    const d = new Date()
    const p = (n: number) => String(n).padStart(2, "0")
    fileName = `output-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.${extFor(format)}`
  }

  // ===== 上游 office 工具产物：LLM 生成的 docx/xlsx/pptx/pdf 文件 =====
  // 当输出节点自身未落盘（download 模式）或需要展示上游生成物时，优先暴露 office 产物
  if (!music && !filePath) {
    const generated = findUpstreamGeneratedFile(context)
    if (generated) {
      filePath = generated.filePath
      fileName = generated.fileName
      try {
        const stat = await fs.stat(path.join(STORAGE_ROOT, generated.filePath))
        fileSize = stat.size
      } catch {
        /* 文件可能尚未写入 */
      }
    }
  }

  return {
    output,
    raw,
    format,
    ...(fileName ? { fileName } : {}),
    ...(localPath ? { localPath } : {}),
    ...(filePath ? { filePath } : {}),
    ...(fileSize !== undefined ? { fileSize } : {}),
  }
}
