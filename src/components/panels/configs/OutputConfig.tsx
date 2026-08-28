"use client"

import { useWorkflowStore } from "@/stores/workflow"
import { useRunResultsStore } from "@/stores/runResults"
import type { WorkflowNode } from "@/types/workflow"
import { useTranslation } from "@/i18n"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Download } from "lucide-react"
import { MusicPlayer } from "@/components/music/MusicPlayer"

interface OutputConfigProps { node: WorkflowNode }

export function OutputConfig({ node }: OutputConfigProps) {
  const { t } = useTranslation()
  const { updateNodeData, workflowId } = useWorkflowStore()
  const runResult = useRunResultsStore((s) => (workflowId && s.results[workflowId]?.[node.id]) || null)
  const clearNodeResult = useRunResultsStore((s) => s.clearNodeResult)
  const config = (node.data.config as Record<string, unknown>) || {}

  const updateConfig = (key: string, value: unknown) => {
    updateNodeData(node.id, { config: { ...config, [key]: value } })
  }

  return (
    <div className="space-y-4">
      {runResult && (
        <>
          <div className="space-y-2">
            <Label>{t("config.outputResult")}</Label>
            <div className="rounded-xl border border-node-music-bg bg-node-music-bg/40 p-3">
              <MusicPlayer audioUrl={runResult.audioUrl} fileName={runResult.fileName} />
            </div>
            <div className="flex items-center gap-2">
              <a href={runResult.audioUrl} download={runResult.fileName}>
                <Button variant="outline" size="sm"><Download className="h-3.5 w-3.5 mr-1" />{t("audioResult.download")}</Button>
              </a>
              <Button variant="ghost" size="sm" onClick={() => clearNodeResult(workflowId!, node.id)}>
                {t("audioResult.clear")}
              </Button>
            </div>
            {Object.keys(runResult.metadata || {}).length > 0 && (
              <div className="mt-2 rounded-lg border border-border/60 bg-background/60 p-2">
                <div className="mb-1 text-[11px] font-semibold text-foreground">{t("audioResult.metadata")}</div>
                <dl className="text-[11px] space-y-0.5">
                  {Object.entries(runResult.metadata).map(([k, v]) => {
                    const label = t(`audioResult.fields.${k}`)
                    return (
                      <div key={k} className="flex gap-2">
                        <dt className="text-muted-foreground min-w-[60px] truncate">{label === `audioResult.fields.${k}` ? k : label}</dt>
                        <dd className="text-foreground break-all">{String(v)}</dd>
                      </div>
                    )
                  })}
                </dl>
              </div>
            )}
          </div>
          <Separator />
        </>
      )}
      <div className="space-y-2">
        <Label>{t("config.format")}</Label>
        <Select value={(config.format as string) || "text"} onValueChange={(v) => updateConfig("format", v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="text">Text</SelectItem>
            <SelectItem value="json">JSON</SelectItem>
            <SelectItem value="markdown">Markdown</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="output-template">{t("config.template")}</Label>
        <Textarea id="output-template" value={(config.template as string) || ""} onChange={(e) => updateConfig("template", e.target.value)} placeholder={t("config.templatePlaceholder")} rows={4} />
      </div>
      <Separator />
      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">{t("config.exportSettings")}</summary>
        <div className="mt-3 space-y-3">
          <div className="space-y-2">
            <Label>{t("config.exportMode")}</Label>
            <Select value={(config.exportMode as string) || "download"} onValueChange={(v) => updateConfig("exportMode", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="download">{t("config.exportDownload")}</SelectItem>
                <SelectItem value="local">{t("config.exportLocal")}</SelectItem>
                <SelectItem value="remote">{t("config.exportRemote")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {((config.exportMode as string) || "download") === "local" && (
            <div className="space-y-2">
              <Label htmlFor="export-path">{t("config.exportPath")}</Label>
              <Input id="export-path" value={(config.exportPath as string) || ""} onChange={(e) => updateConfig("exportPath", e.target.value)} placeholder="storage/exports/" className="text-sm font-mono" />
              <p className="text-[10px] text-muted-foreground">{t("config.exportPathHint")}</p>
            </div>
          )}
          {((config.exportMode as string) || "download") === "remote" && (
            <div className="space-y-2">
              <Label htmlFor="remote-url">{t("config.remoteUrl")}</Label>
              <Input id="remote-url" value={(config.remoteUrl as string) || ""} onChange={(e) => updateConfig("remoteUrl", e.target.value)} placeholder="https://upload.example.com" className="text-sm font-mono" />
            </div>
          )}
        </div>
      </details>
    </div>
  )
}