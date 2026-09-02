"use client"

import { useWorkflowStore } from "@/stores/workflow"
import type { WorkflowNode } from "@/types/workflow"
import { useTranslation } from "@/i18n"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface MergeConfigProps { node: WorkflowNode }

export function MergeConfig({ node }: MergeConfigProps) {
  const { t } = useTranslation()
  const { updateNodeData } = useWorkflowStore()
  const config = (node.data.config as Record<string, unknown>) || {}

  const updateConfig = (key: string, value: unknown) => {
    updateNodeData(node.id, { config: { ...config, [key]: value } })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>{t("config.mergeStrategy")}</Label>
        <Select value={(config.strategy as string) || "concat"} onValueChange={(v) => updateConfig("strategy", v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="concat">{t("config.mergeConcat")}</SelectItem>
            <SelectItem value="json_array">{t("config.mergeJsonArray")}</SelectItem>
            <SelectItem value="first">{t("config.mergeFirst")}</SelectItem>
            <SelectItem value="last">{t("config.mergeLast")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="p-3 rounded-lg bg-node-merge-bg text-xs">
        {t("config.mergeHint")}
      </div>
    </div>
  )
}