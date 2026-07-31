"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useTranslation } from "@/i18n"
import { getNextRunTime } from "@/lib/cron-helper"
import { Workflow, Plus, ArrowRight, Loader2, Trash2, Music } from "lucide-react"
import { useWorkflowStore } from "@/stores/workflow"
import type { WorkflowConfig } from "@/types/workflow"

type TemplateNode = { id: string; type: string; position: { x: number; y: number }; data: { type: string; label: string; config: Record<string, unknown> } }
type TemplateEdge = { id: string; source: string; target: string }

export default function WorkflowsPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const { setWorkflow, setWorkflowId } = useWorkflowStore()
  const [workflows, setWorkflows] = useState<(WorkflowConfig & { enabled?: boolean; schedule?: string | null })[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<WorkflowConfig | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [creatingTemplate, setCreatingTemplate] = useState(false)

  const handleCreateFromMusicTemplate = async () => {
    setCreatingTemplate(true)
    try {
      const lang = typeof localStorage !== "undefined" ? (localStorage.getItem("workflow-locale") || "zh") : "zh"
      const tpl = await fetch(`/api/workflow/template/music?lang=${lang}`).then((r) => r.json())
      setWorkflow(
        { id: "", name: tpl.name, description: tpl.description, config: {}, createdAt: "", updatedAt: "" },
        tpl.nodes.map((n: TemplateNode) => ({ id: n.id, type: n.type as never, position: n.position, data: n.data })),
        tpl.edges.map((e: TemplateEdge) => ({ id: e.id, source: e.source, target: e.target })),
      )
      setWorkflowId(null)
      router.push("/workflow/new")
    } catch (e) {
      console.error(e)
    } finally {
      setCreatingTemplate(false)
    }
  }

  const fetchWorkflows = useCallback(() => {
    setLoading(true)
    fetch("/api/workflow")
      .then((r) => r.json())
      .then(setWorkflows)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchWorkflows() }, [fetchWorkflows])

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/workflow/${deleteTarget.id}`, { method: "DELETE" })
      if (res.ok) { setWorkflows((prev) => prev.filter((w) => w.id !== deleteTarget.id)); setDeleteTarget(null) }
    } catch (err) { console.error(err) }
    finally { setDeleting(false) }
  }

  const toggleEnabled = async (id: string, current: boolean) => {
    setWorkflows((prev) => prev.map((w) => w.id === id ? { ...w, enabled: !current } : w))
    await fetch(`/api/workflow/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !current }),
    })
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("workflows.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("workflows.description")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/workflow/new">
            <Button><Plus className="h-4 w-4 mr-2" />{t("workflows.newWorkflow")}</Button>
          </Link>
          <Button variant="outline" onClick={handleCreateFromMusicTemplate} disabled={creatingTemplate}>
            <Music className="h-4 w-4 mr-2" />{t("workflows.musicTemplate")}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : workflows.length === 0 ? (
        <Card className="p-12 text-center">
          <Workflow className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-1">{t("workflows.noWorkflows")}</h3>
          <p className="text-muted-foreground mb-4">{t("workflows.noWorkflowsDesc")}</p>
          <Link href="/workflow/new"><Button><Plus className="h-4 w-4 mr-2" />{t("workflows.createWorkflow")}</Button></Link>
        </Card>
      ) : (
        <div className="space-y-3">
          {workflows.map((wf) => (
            <Card key={wf.id} className="group hover:border-primary transition-colors">
              <CardHeader className="flex flex-row items-center justify-between py-3">
                <Link href={`/workflow/${wf.id}`} className="flex-1 min-w-0 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-sm">{wf.name}</CardTitle>
                  </div>
                  <Badge variant="secondary" className="text-xs flex-shrink-0">{new Date(wf.createdAt).toLocaleDateString()}</Badge>
                  {wf.schedule && (
                    <Badge variant="outline" className="text-[10px] flex-shrink-0">
                      ⏰ {getNextRunTime(wf.schedule)}
                    </Badge>
                  )}
                  <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </Link>
                <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                  <Switch checked={wf.enabled !== false} onCheckedChange={() => toggleEnabled(wf.id, wf.enabled !== false)} />
                  <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                    onClick={(e) => { e.preventDefault(); setDeleteTarget(wf) }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("workflows.deleteTitle")}</DialogTitle>
            <DialogDescription>{t("workflows.deleteDesc", { name: deleteTarget?.name ?? "" })}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>{t("workflows.cancel")}</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}{t("workflows.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
