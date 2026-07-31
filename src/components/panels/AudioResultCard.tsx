"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Play, Download, Trash2, Loader2 } from "lucide-react"
import { useTranslation } from "@/i18n"

interface AudioResultCardProps {
  executionId: string
  nodeId: string
  audioUrl: string
  fileName: string
  metadata: Record<string, unknown>
  onCleared?: () => void
}

export function AudioResultCard({ executionId, nodeId, audioUrl, fileName, metadata, onCleared }: AudioResultCardProps) {
  const { t } = useTranslation()
  const [clearing, setClearing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClear = async () => {
    setClearing(true)
    setError(null)
    try {
      const res = await fetch(`/api/music/file?executionId=${encodeURIComponent(executionId)}&nodeId=${encodeURIComponent(nodeId)}`, { method: "DELETE" })
      if (!res.ok) throw new Error("delete failed")
      onCleared?.()
    } catch {
      setError(t("audioResult.clearFailed"))
    } finally {
      setClearing(false)
    }
  }

  const known: Record<string, string> = {
    title: t("audioResult.title"),
    duration: t("audioResult.duration"),
    style: t("audioResult.style"),
  }
  const entries = Object.entries(metadata || {})

  return (
    <div className="mt-3 space-y-3">
      <Card className="p-3 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
          <Play className="h-3.5 w-3.5" />{t("audioResult.preview")}
        </div>
        <audio controls src={audioUrl} className="w-full" />
        <div className="text-xs text-muted-foreground break-all">{fileName}</div>
      </Card>

      <Card className="p-3 space-y-2">
        <div className="text-xs font-semibold text-foreground">{t("audioResult.preview")}</div>
        {entries.length === 0 ? (
          <div className="text-xs text-muted-foreground">{t("audioResult.noMetadata")}</div>
        ) : (
          <dl className="text-xs space-y-1">
            {entries.map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <dt className="text-muted-foreground min-w-[60px]">{known[k] || k}</dt>
                <dd className="text-foreground break-all">{String(v)}</dd>
              </div>
            ))}
          </dl>
        )}
      </Card>

      <div className="flex items-center gap-2">
        <a href={audioUrl} download={fileName}>
          <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-1" />{t("audioResult.download")}</Button>
        </a>
        <Button variant="outline" size="sm" onClick={handleClear} disabled={clearing}>
          {clearing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
          {clearing ? t("audioResult.clearing") : t("audioResult.clear")}
        </Button>
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
    </div>
  )
}
