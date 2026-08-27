"use client"

import { useState, useEffect } from "react"
import { useWorkflowStore } from "@/stores/workflow"
import type { WorkflowNode } from "@/types/workflow"
import { useTranslation } from "@/i18n"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface KnowledgeSearchConfigProps { node: WorkflowNode }

export function KnowledgeSearchConfig({ node }: KnowledgeSearchConfigProps) {
  const { t } = useTranslation()
  const { updateNodeData } = useWorkflowStore()
  const config = (node.data.config as Record<string, unknown>) || {}
  const [documents, setDocuments] = useState<Array<{ id: string; name: string }>>([])

  useEffect(() => {
    fetch("/api/documents").then(r => r.json()).then(setDocuments).catch(() => {})
  }, [])

  const updateConfig = (key: string, value: unknown) => {
    updateNodeData(node.id, { config: { ...config, [key]: value } })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>{t("config.knowledge")}</Label>
        <Select value={(config.knowledgeId as string) || "_all"} onValueChange={(v) => updateConfig("knowledgeId", v === "_all" ? "" : v)}>
          <SelectTrigger><SelectValue placeholder={t("config.knowledgePlaceholder")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">{t("config.knowledgeAll")}</SelectItem>
            {documents.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="ks-top-k" className="text-xs text-muted-foreground">{t("config.knowledgeTopK")}</Label>
        <Input id="ks-top-k" type="number" min={1} max={20} step={1} value={(config.topK as number) ?? 3}
          onChange={(e) => {
            const n = parseInt(e.target.value)
            if (!isNaN(n)) updateConfig("topK", Math.min(Math.max(n, 1), 20))
          }} />
        <p className="text-[10px] text-muted-foreground">{t("config.knowledgeTopKHint")}</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="ks-query-template" className="text-xs text-muted-foreground">{t("config.knowledgeQueryTemplate")}</Label>
        <Input id="ks-query-template" value={(config.queryTemplate as string) || ""} onChange={(e) => updateConfig("queryTemplate", e.target.value)}
          placeholder="{{ $input.message }}" className="text-sm font-mono" />
        <p className="text-[10px] text-muted-foreground">{t("config.knowledgeQueryTemplateHint")}</p>
      </div>
      <div className="p-3 rounded-lg bg-node-knowledge-bg text-xs text-muted-foreground">
        {t("config.knowledgeSearchHint")}
      </div>
    </div>
  )
}
