"use client"

import { useWorkflowStore } from "@/stores/workflow"
import type { WorkflowNode } from "@/types/workflow"
import { useTranslation } from "@/i18n"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface DelayConfigProps { node: WorkflowNode }

export function DelayConfig({ node }: DelayConfigProps) {
  const { t } = useTranslation()
  const { updateNodeData } = useWorkflowStore()
  const config = (node.data.config as Record<string, unknown>) || {}

  const updateConfig = (key: string, value: unknown) => {
    updateNodeData(node.id, { config: { ...config, [key]: value } })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="delay-duration" className="text-xs text-muted-foreground">{t("config.delayDuration")}</Label>
        <Input id="delay-duration" type="number" min={100} max={300000} step={100} value={(config.durationMs as number) ?? 1000}
          onChange={(e) => {
            const n = parseInt(e.target.value)
            if (!isNaN(n)) updateConfig("durationMs", Math.min(Math.max(n, 100), 300000))
          }} />
        <p className="text-[10px] text-muted-foreground">{t("config.delayDurationHint")}</p>
      </div>
    </div>
  )
}
