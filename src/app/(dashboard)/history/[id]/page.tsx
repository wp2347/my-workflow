"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, CheckCircle, XCircle, ArrowLeft, Clock } from "lucide-react"

export default function ExecutionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/workflow/executions/${id}`)
      .then(r => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
  if (!data) return <div className="p-6">未找到执行记录</div>

  const logs = (data.logs as Array<Record<string, unknown>>) || []

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">{data.workflowName as string || "执行详情"}</h1>
          <p className="text-sm text-muted-foreground">
            {new Date(data.createdAt as string).toLocaleString()} · {(data.durationMs as number) || 0}ms
          </p>
        </div>
        <Badge variant={(data.status as string) === "completed" ? "default" : "destructive"}>
          {(data.status as string) === "completed" ? "成功" : "失败"}
        </Badge>
      </div>

      <ScrollArea className="h-[calc(100vh-160px)]">
        <div className="space-y-3 pr-4">
          {logs.map((log, i) => (
            <Card key={i} className={log.status === "failed" ? "border-red-200" : "border-green-200"}>
              <CardHeader className="py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {log.status === "completed" ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
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
                  <div className="mt-2 p-2 rounded bg-red-50 dark:bg-red-950 text-xs text-red-600 font-mono">
                    {String(log.error).substring(0, 200)}
                  </div>
                )}

                {Boolean(log.output) && (
                  <details className="mt-2 text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">输出数据</summary>
                    <pre className="mt-1 p-2 rounded bg-muted font-mono text-[11px] whitespace-pre-wrap break-all max-h-48 overflow-auto">
                      {JSON.stringify(log.output, null, 2).substring(0, 1000)}
                    </pre>
                  </details>
                )}
              </CardHeader>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
