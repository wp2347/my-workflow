"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Download, Trash2, Loader2, FileText, File as FileIcon, Image as ImageIcon, Table, Presentation, Sheet as SheetIcon, FileCode } from "lucide-react"
import { useTranslation } from "@/i18n"

interface FileResultCardProps {
  executionId: string
  nodeId: string
  workflowId?: string
  fileName: string
  filePath: string
  fileSize?: number
  /** 文本类内容预览（md/txt/json/csv），二进制类为空 */
  preview?: string
  onCleared?: () => void
}

/** 根据扩展名返回图标与是否文本可预览 */
function fileMeta(name: string): { icon: React.ReactNode; previewable: boolean } {
  const ext = name.split(".").pop()?.toLowerCase() || ""
  switch (ext) {
    case "docx": return { icon: <FileText className="h-4 w-4" />, previewable: false }
    case "xlsx": return { icon: <Table className="h-4 w-4" />, previewable: false }
    case "pptx": return { icon: <Presentation className="h-4 w-4" />, previewable: false }
    case "pdf": return { icon: <FileIcon className="h-4 w-4" />, previewable: false }
    case "png": case "jpg": case "jpeg": case "gif": case "webp": return { icon: <ImageIcon className="h-4 w-4" />, previewable: false }
    case "csv": return { icon: <SheetIcon className="h-4 w-4" />, previewable: true }
    case "md": case "txt": case "json": return { icon: <FileCode className="h-4 w-4" />, previewable: true }
    default: return { icon: <FileIcon className="h-4 w-4" />, previewable: false }
  }
}

function formatSize(bytes?: number): string {
  if (!bytes) return "—"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function FileResultCard({ executionId, nodeId, workflowId, fileName, filePath, fileSize, preview, onCleared }: FileResultCardProps) {
  const { t } = useTranslation()
  const [clearing, setClearing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const meta = fileMeta(fileName)
  const downloadUrl = `/api/storage/file?path=${encodeURIComponent(filePath)}`

  const handleClear = async () => {
    setClearing(true)
    setError(null)
    try {
      const res = await fetch(downloadUrl, { method: "DELETE" })
      if (!res.ok) throw new Error("delete failed")
      onCleared?.()
    } catch {
      setError(t("audioResult.clearFailed"))
    } finally {
      setClearing(false)
    }
  }

  return (
    <div className="mt-3 space-y-3">
      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border bg-gradient-to-r from-node-music-bg/50 to-transparent px-3 py-2">
          <div className="rounded-md bg-node-music-bg p-1">{meta.icon}</div>
          <span className="text-xs font-semibold text-foreground truncate">{fileName}</span>
          <span className="ml-auto text-[11px] text-muted-foreground shrink-0">{formatSize(fileSize)}</span>
        </div>
        {meta.previewable && preview ? (
          <pre className="max-h-56 overflow-auto p-3 text-xs font-mono whitespace-pre-wrap break-all text-foreground/90">{preview}</pre>
        ) : (
          <div className="p-4 text-xs text-muted-foreground">
            {t("fileResult.binaryHint")} {fileName}
          </div>
        )}
      </Card>

      <div className="flex items-center gap-2">
        <a href={downloadUrl} download={fileName}>
          <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-1" />{t("audioResult.download")}</Button>
        </a>
        <Button variant="outline" size="sm" onClick={handleClear} disabled={clearing}>
          {clearing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
          {clearing ? t("audioResult.clearing") : t("audioResult.clear")}
        </Button>
        {error && <span className="text-xs text-destructive">{error}</span>}
        <span className="ml-auto text-[11px] text-muted-foreground hidden">{executionId || workflowId || nodeId}</span>
      </div>
    </div>
  )
}