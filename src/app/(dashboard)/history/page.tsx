"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useTranslation } from "@/i18n"
import { Loader2, Clock, CheckCircle, XCircle, Activity, ChevronLeft, ChevronRight, ArrowRight } from "lucide-react"

interface ExecutionRow {
  id: string
  workflowId: string
  workflowName: string
  status: string
  input: Record<string, unknown>
  output: Record<string, unknown> | null
  error: string | null
  startedAt: string | null
  finishedAt: string | null
  durationMs: number | null
  createdAt: string
}

export default function HistoryPage() {
  const { t } = useTranslation()
  const [executions, setExecutions] = useState<ExecutionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const pageSize = 20

  const fetchData = (p: number) => {
    setLoading(true)
    fetch(`/api/workflow/executions?page=${p}&pageSize=${pageSize}`)
      .then((r) => r.json())
      .then((data) => {
        setExecutions(data.items || [])
        setTotalPages(data.totalPages || 1)
        setPage(data.page || 1)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchData(1) }, [])

  return (
    <div className="p-6 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6" />
            {t("history.title")}
          </h1>
          <p className="text-muted-foreground mt-1">{t("history.description")}</p>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <ScrollArea className="h-full">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : executions.length === 0 ? (
            <Card className="p-12 text-center">
              <Clock className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-1">{t("history.noExecutions")}</h3>
              <p className="text-muted-foreground">{t("history.noExecutionsDesc")}</p>
            </Card>
          ) : (
            <div className="space-y-2 pr-4 pb-4">
              {executions.map((ex) => (
                <Link href={`/history/${ex.id}`} key={ex.id}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                  <CardHeader className="flex flex-row items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      {ex.status === "completed" ? (
                        <CheckCircle className="h-5 w-5 text-success flex-shrink-0" />
                      ) : ex.status === "failed" ? (
                        <XCircle className="h-5 w-5 text-destructive flex-shrink-0" />
                      ) : (
                        <Loader2 className="h-5 w-5 animate-spin text-info flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <CardTitle className="text-sm truncate">{ex.workflowName}</CardTitle>
                        <CardDescription className="truncate">
                          {new Date(ex.createdAt).toLocaleString()} · {ex.id.substring(0, 12)}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {ex.error && (
                        <span className="text-xs text-destructive truncate max-w-[120px] hidden sm:inline">
                          {ex.error.substring(0, 40)}
                        </span>
                      )}
                      {ex.durationMs != null && (
                        <Badge variant="secondary" className="text-xs">
                          {ex.durationMs > 1000
                            ? `${(ex.durationMs / 1000).toFixed(1)}s`
                            : `${ex.durationMs}ms`}
                        </Badge>
                      )}
                      <Badge
                        variant={ex.status === "completed" ? "default" : ex.status === "failed" ? "destructive" : "secondary"}
                        className="text-xs"
                      >
                        {ex.status === "completed" ? t("workflows.completed") : ex.status === "failed" ? t("workflows.failed") : ex.status}
                      </Badge>
                </div>
              </CardHeader>
            </Card>
            </Link>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4 border-t border-border">
          <Button
            variant="outline" size="sm"
            disabled={page <= 1}
            onClick={() => fetchData(page - 1)}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            {t("workflows.prev")}
          </Button>
          <span className="text-sm text-muted-foreground px-3">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline" size="sm"
            disabled={page >= totalPages}
            onClick={() => fetchData(page + 1)}
          >
            {t("workflows.next")}
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  )
}
