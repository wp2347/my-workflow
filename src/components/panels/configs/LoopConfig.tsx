"use client"

import { useWorkflowStore } from "@/stores/workflow"
import type { WorkflowNode } from "@/types/workflow"
import { useTranslation } from "@/i18n"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface LoopConfigProps { node: WorkflowNode }

export function LoopConfig({ node }: LoopConfigProps) {
  const { t } = useTranslation()
  const { updateNodeData } = useWorkflowStore()
  const config = (node.data.config as Record<string, unknown>) || {}

  const updateConfig = (key: string, value: unknown) => {
    updateNodeData(node.id, { config: { ...config, [key]: value } })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="loop-source">{t("config.loopSource")}</Label>
        <Input id="loop-source" value={(config.sourcePath as string) || ""} onChange={(e) => updateConfig("sourcePath", e.target.value)}
          placeholder="{{ $node.knowledge_search-1.results }}" className="text-sm font-mono" />
        <p className="text-[10px] text-muted-foreground">{t("config.loopSourceHint")}</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="loop-template" className="text-xs text-muted-foreground">{t("config.loopItemTemplate")}</Label>
        <Input id="loop-template" value={(config.itemTemplate as string) || ""} onChange={(e) => updateConfig("itemTemplate", e.target.value)}
          placeholder="{{ $item.title }} — {{ $item.summary }}" className="text-sm font-mono" />
        <p className="text-[10px] text-muted-foreground">{t("config.loopItemTemplateHint")}</p>
      </div>
      <div className="p-3 rounded-lg bg-node-loop-bg text-xs text-muted-foreground">
        {t("config.loopLimitHint")}
      </div>
    </div>
  )
}
