"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Download, Trash2, Loader2, Music } from "lucide-react"
import { useTranslation } from "@/i18n"
import { MusicPlayer } from "@/components/music/MusicPlayer"

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

  const fieldLabel = (key: string): string => {
    const label = t(`audioResult.fields.${key}`)
    return label === `audioResult.fields.${key}` ? key : label
  }
  const entries = Object.entries(metadata || {})

  return (
    <div className="mt-3 space-y-3">
      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border bg-gradient-to-r from-node-music-bg/50 to-transparent px-3 py-2">
          <div className="rounded-md bg-node-music-bg p-1">
            <Music className="h-3.5 w-3.5 text-node-music" />
          </div>
          <span className="text-xs font-semibold text-foreground">{t("audioResult.preview")}</span>
        </div>
        <div className="p-3">
          <MusicPlayer audioUrl={audioUrl} fileName={fileName} />
        </div>
      </Card>

      <Card className="p-3 space-y-2">
        <div className="text-xs font-semibold text-foreground">{t("audioResult.metadata")}</div>
        {entries.length === 0 ? (
          <div className="text-xs text-muted-foreground">{t("audioResult.noMetadata")}</div>
        ) : (
          <dl className="text-xs space-y-1">
            {entries.map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <dt className="text-muted-foreground min-w-[60px]">{fieldLabel(k)}</dt>
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
