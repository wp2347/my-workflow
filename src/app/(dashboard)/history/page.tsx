"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useTranslation } from "@/i18n"
import { Loader2, Clock, CheckCircle, XCircle, Activity, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react"

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

type StatusFilter = "" | "completed" | "failed" | "running" | "pending"

export default function HistoryPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const [executions, setExecutions] = useState<ExecutionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [status, setStatus] = useState<StatusFilter>("")
  const [rerunning, setRerunning] = useState<string | null>(null)
  const pageSize = 20

  const fetchData = useCallback((p: number, s: StatusFilter, showLoading = true) => {
    if (showLoading) setLoading(true)
    const query = new URLSearchParams({ page: String(p), pageSize: String(pageSize) })
    if (s) query.set("status", s)
    fetch(`/api/workflow/executions?${query}`)
      .then((r) => r.json())
      .then((data) => {
        setExecutions(data.items || [])
        setTotalPages(data.totalPages || 1)
        setPage(data.page || 1)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  // 首次加载与环境状态切换：effect 内不得同步 setState
  // （loading 初值为 true 兜底；切换时新 tab 即时高亮，数据随后到达）
  useEffect(() => { fetchData(1, status, false) }, [fetchData, status])

  const handleStatusChange = (s: StatusFilter) => {
    setStatus(s)
    setPage(1)
  }

  const handleRerun = async (ex: ExecutionRow, e: React.MouseEvent) => {
    e.preventDefault() // 阻止 Link 跳转到详情
    e.stopPropagation()
    setRerunning(ex.id)
    try {
      const res = await fetch("/api/workflow/run", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflowId: ex.workflowId, input: ex.input || {} }),
      })
      if (!res.ok) throw new Error("Rerun failed")
      const data = await res.json()
      router.push(`/history/${data.executionId}`)
    } catch (err) {
      console.error(err)
    } finally {
      setRerunning(null)
    }
  }

  const statusTabs: Array<{ value: StatusFilter; label: string }> = [
    { value: "", label: t("history.filterAll") },
    { value: "completed", label: t("history.filterCompleted") },
    { value: "failed", label: t("history.filterFailed") },
    { value: "running", label: t("history.filterRunning") },
  ]

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

      {/* 状态筛选 */}
      <div className="flex items-center gap-1 mb-4">
        {statusTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => handleStatusChange(tab.value)}
            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
              status === tab.value
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border hover:border-primary/50"
            }`}
          >
            {tab.label}
          </button>
        ))}
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
                        <Button
                          variant="ghost" size="sm"
                          className="h-7 px-2"
                          title={t("history.rerun")}
                          disabled={rerunning === ex.id}
                          onClick={(e) => handleRerun(ex, e)}
                        >
                          {rerunning === ex.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                        </Button>
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
            onClick={() => fetchData(page - 1, status)}
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
            onClick={() => fetchData(page + 1, status)}
          >
            {t("workflows.next")}
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  )
}
