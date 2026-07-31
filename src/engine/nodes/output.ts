import { promises as fs } from "fs"
import path from "path"
import type { WorkflowNode, ExecutionContext, NodeExecutor } from "@/types/workflow"

function exportBaseDir(): string {
  return process.env.EXPORT_STORAGE_DIR || path.join(process.cwd(), "storage", "exports")
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
      const dir = (config.exportPath as string) || exportBaseDir()
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

  return {
    output,
    raw: typeof output === "string" ? output : JSON.stringify(output),
    format,
  }
}
