"use client"

import { useRouter } from "next/navigation"
import { useWorkflowStore } from "@/stores/workflow"
import { useRunResultsStore } from "@/stores/runResults"
import { useTranslation } from "@/i18n"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MusicPlayer } from "@/components/music/MusicPlayer"
import { Save, Play, ArrowLeft, Loader2, Zap, Webhook } from "lucide-react"
import { useState } from "react"

export function Toolbar() {
  const router = useRouter()
  const { t } = useTranslation()
  const { workflowId, workflowName, setWorkflowName, nodes, edges, isDirty, markClean } = useWorkflowStore()
  const setNodeResult = useRunResultsStore((s) => s.setNodeResult)
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)
  const [runResult, setRunResult] = useState<string | null>(null)
  const [runAudio, setRunAudio] = useState<{ audioUrl: string; fileName: string } | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [showWebhook, setShowWebhook] = useState(false)
  const [webhookUrl, setWebhookUrl] = useState("")
  const [webhookCopied, setWebhookCopied] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const body = {
        name: workflowName,
        nodes: nodes.map((n) => ({
          id: n.id, type: n.data.type, positionX: n.position.x, positionY: n.position.y, data: n.data,
        })),
        edges: edges.map((e) => ({
          id: e.id, source: e.source, target: e.target,
          sourceHandle: e.sourceHandle || null, targetHandle: e.targetHandle || null,
        })),
      }
      const method = workflowId ? "PUT" : "POST"
      const url = workflowId ? `/api/workflow/${workflowId}` : "/api/workflow"
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      if (!res.ok) throw new Error("Failed to save")
      const data = await res.json()
      if (!workflowId) { markClean(); router.replace(`/workflow/${data.id}`) }
      else { markClean() }
    } catch (err) { console.error("Save failed:", err) }
    finally { setSaving(false) }
  }

  const handleRun = async () => {
    if (!workflowId) return
    setRunning(true)
    setRunResult(null)
    setRunAudio(null)
    try {
      // Get workflow to read notifyChatId
      const wfRes = await fetch(`/api/workflow/${workflowId}`)
      const wfData = await wfRes.json()
      const chatId = wfData.notifyChatId || ""

      const res = await fetch("/api/workflow/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflowId, input: { message: "manual-test", chatId } }),
      })
      const data = await res.json()

      // 将 output 节点的音频结果写入持久化 store（下次执行时自动覆盖）
      let foundAudio: { audioUrl: string; fileName: string } | null = null
      for (const log of data.logs || []) {
        const out = log.output as Record<string, unknown> | null
        if (out && typeof out === "object" && typeof out.audioUrl === "string") {
          setNodeResult(workflowId, log.nodeId, {
            audioUrl: out.audioUrl as string,
            fileName: (out.fileName as string) || "audio",
            metadata: (out.metadata as Record<string, unknown>) || {},
            executionId: data.executionId,
            status: data.status,
            updatedAt: new Date().toISOString(),
          })
          if (!foundAudio) {
            foundAudio = {
              audioUrl: out.audioUrl as string,
              fileName: (out.fileName as string) || "audio",
            }
          }
        }
      }
      setRunAudio(foundAudio)

      const lines: string[] = []
      lines.push(t("toolbar.status", { status: data.status }))
      lines.push(t("toolbar.duration", { duration: data.durationMs }))
      lines.push("")

      for (const log of data.logs || []) {
        const icon = log.status === "completed" ? "✅" : "❌"
        lines.push(`${icon} ${log.nodeType.toUpperCase()}`)
        if (log.error) lines.push(t("toolbar.error", { error: log.error }))
        if (log.output) {
          const out = typeof log.output === "string" ? log.output : JSON.stringify(log.output)
          if (out.length > 200) lines.push(t("toolbar.output", { output: out.substring(0, 200) + "..." }))
          else if (out) lines.push(t("toolbar.output", { output: out }))
        }
        lines.push("")
      }
      setRunResult(lines.join("\n"))
    } catch (err) {
      setRunResult(t("toolbar.requestFailed", { error: err instanceof Error ? err.message : String(err) }))
    } finally {
      setRunning(false)
      setShowResult(true)
    }
  }

  const handleTest = () => { if (workflowId) router.push(`/chat/${workflowId}`) }

  const handleWebhook = async () => {
    if (!workflowId) return
    const res = await fetch(`/api/workflow/${workflowId}`)
    const wf = await res.json()
    let wid = wf.webhookId
    if (!wid) {
      // Generate webhook
      wid = crypto.randomUUID().substring(0, 8)
      const secret = crypto.randomUUID().substring(0, 16)
      await fetch(`/api/workflow/${workflowId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookId: wid, webhookSecret: secret }),
      })
    }
    const base = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
    setWebhookUrl(`${base}/api/webhook/${wid}`)
    setShowWebhook(true)
  }

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl)
    setWebhookCopied(true)
    setTimeout(() => setWebhookCopied(false), 2000)
  }

  return (
    <>
      <div className="h-14 border-b border-border bg-card flex items-center justify-between px-4 gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/workflows")} className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Input
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
            className="h-8 w-64 text-sm font-medium border-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-0"
            placeholder={t("config.untitled")}
          />
          {isDirty && <Badge variant="secondary" className="text-xs">{t("config.unsaved")}</Badge>}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleTest} disabled={!workflowId}>
            <Play className="h-4 w-4 mr-1" />{t("config.test")}
          </Button>
          <Button size="sm" variant="secondary" onClick={handleRun} disabled={!workflowId || running}>
            {running ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Zap className="h-4 w-4 mr-1" />}
            {t("toolbar.run")}
          </Button>
          <Button size="sm" variant="outline" onClick={handleWebhook} disabled={!workflowId}>
            <Webhook className="h-4 w-4 mr-1" />{t("toolbar.webhook")}
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            {t("config.save")}
          </Button>
        </div>
      </div>

      <Dialog open={showWebhook} onOpenChange={setShowWebhook}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("toolbar.webhookTitle")}</DialogTitle>
            <DialogDescription>{t("toolbar.webhookDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <code className="block p-3 bg-muted rounded-lg text-sm font-mono break-all select-all">
              {webhookUrl}
            </code>
            <Button size="sm" onClick={copyWebhook}>
              {webhookCopied ? t("toolbar.copied") : t("toolbar.copy")}
            </Button>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>{t("toolbar.curlExample")}</p>
              <code className="block p-2 bg-muted rounded text-xs">
                {`curl -X POST "${webhookUrl}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"message":"hello"}'`}
              </code>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showResult} onOpenChange={setShowResult}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("toolbar.runResultTitle")}</DialogTitle>
          </DialogHeader>
          {runAudio && (
            <div className="rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50/60 to-transparent p-3 dark:border-purple-800/40 dark:from-purple-950/30">
              <MusicPlayer audioUrl={runAudio.audioUrl} fileName={runAudio.fileName} />
            </div>
          )}
          <ScrollArea className="max-h-[60vh]">
            <pre className="text-xs whitespace-pre-wrap break-all font-mono">{runResult}</pre>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  )
}
