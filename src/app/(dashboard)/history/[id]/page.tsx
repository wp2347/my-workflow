"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AudioResultCard } from "@/components/panels/AudioResultCard"
import { FileResultCard } from "@/components/panels/FileResultCard"
import { useTranslation } from "@/i18n"
import type { ToolCallStep } from "@/types/workflow"
import { Loader2, CheckCircle, XCircle, ArrowLeft } from "lucide-react"

export default function ExecutionDetailPage() {
  const { t } = useTranslation()
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [clearedKeys, setClearedKeys] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch(`/api/workflow/executions/${id}`)
      .then(r => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
  if (!data) return <div className="p-6">{t("historyDetail.notFound")}</div>

  const logs = (data.logs as Array<Record<string, unknown>>) || []

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">{data.workflowName as string || t("historyDetail.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {new Date(data.createdAt as string).toLocaleString()} · {(data.durationMs as number) || 0}ms
          </p>
        </div>
        <Badge variant={(data.status as string) === "completed" ? "default" : "destructive"}>
          {(data.status as string) === "completed" ? t("historyDetail.completed") : t("historyDetail.failed")}
        </Badge>
      </div>

      <ScrollArea className="h-[calc(100vh-160px)]">
        <div className="space-y-3 pr-4">
          {logs.map((log, i) => (
            <Card key={i} className={log.status === "failed" ? "border-destructive/30" : "border-success/30"}>
              <CardHeader className="py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {log.status === "completed" ? (
                      <CheckCircle className="h-4 w-4 text-success" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                    <CardTitle className="text-sm">
                      {log.nodeType as string} <span className="text-xs text-muted-foreground">({log.nodeId as string})</span>
                    </CardTitle>
                    {log.durationMs != null && (
                      <Badge variant="secondary" className="text-[10px]">
                        {log.durationMs as number}ms
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(log.timestamp as string).toLocaleTimeString()}</span>
                </div>

                {Boolean(log.error) && (
                  <div className="mt-2 p-2 rounded bg-destructive/10 dark:bg-destructive/20 text-xs text-destructive font-mono">
                    {String(log.error).substring(0, 200)}
                  </div>
                )}

                {Array.isArray(log.steps) && (log.steps as ToolCallStep[]).length > 0 && (
                  <details className="mt-2 text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                      {t("historyDetail.toolSteps")} ({(log.steps as ToolCallStep[]).length})
                    </summary>
                    <div className="mt-1 space-y-1.5 p-2 rounded bg-muted font-mono text-[11px]">
                      {(log.steps as ToolCallStep[]).map((step, idx) => (
                        <details key={idx}>
                          <summary className="flex items-center gap-2 cursor-pointer">
                            <span className="font-semibold">{idx + 1}. {step.toolName}</span>
                            <Badge variant="secondary" className="text-[10px] px-1 py-0">{step.durationMs}ms</Badge>
                          </summary>
                          <p className="mt-1 break-all"><span className="text-muted-foreground">{t("historyDetail.argsSummary")}:</span> {step.argsSummary}</p>
                          <p className="break-all"><span className="text-muted-foreground">{t("historyDetail.resultSummary")}:</span> {step.resultSummary}</p>
                        </details>
                      ))}
                    </div>
                  </details>
                )}

                {(() => {
                  const out = log.output as Record<string, unknown> | null
                  const isFile = out && typeof out === "object" && typeof out.filePath === "string"
                  if (isFile) {
                    const clearKey = `file_${id}_${log.nodeId}`
                    if (clearedKeys.has(clearKey)) return null
                    return (
                      <FileResultCard
                        executionId={id}
                        nodeId={log.nodeId as string}
                        fileName={(out!.fileName as string) || "output.bin"}
                        filePath={out!.filePath as string}
                        fileSize={(out!.fileSize as number) || undefined}
                        preview={typeof out!.raw === "string" ? String(out!.raw).slice(0, 2000) : undefined}
                        onCleared={() => setClearedKeys((prev) => new Set(prev).add(clearKey))}
                      />
                    )
                  }
                  const isAudio = out && typeof out === "object" && typeof out.audioUrl === "string"
                  if (isAudio) {
                    const audioNodeId = (out!.audioUrl as string).match(/[?&]nodeId=([^&]+)/)?.[1] || ""
                    const clearKey = `${id}_${audioNodeId}`
                    if (clearedKeys.has(clearKey)) return null
                    return (
                      <AudioResultCard
                        executionId={id}
                        nodeId={audioNodeId}
                        audioUrl={out!.audioUrl as string}
                        fileName={(out!.fileName as string) || "audio"}
                        metadata={(out!.metadata as Record<string, unknown>) || {}}
                        onCleared={() => setClearedKeys((prev) => new Set(prev).add(clearKey))}
                      />
                    )
                  }
                  if (out) {
                    return (
                      <details className="mt-2 text-xs">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">{t("historyDetail.output")}</summary>
                        <pre className="mt-1 p-2 rounded bg-muted font-mono text-[11px] whitespace-pre-wrap break-all max-h-48 overflow-auto">
                          {JSON.stringify(out, null, 2).substring(0, 1000)}
                        </pre>
                      </details>
                    )
                  }
                  return null
                })()}
              </CardHeader>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
