"use client"

import { useWorkflowStore } from "@/stores/workflow"
import type { WorkflowNode } from "@/types/workflow"
import { useTranslation } from "@/i18n"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface ConditionConfigProps { node: WorkflowNode }

export function ConditionConfig({ node }: ConditionConfigProps) {
  const { t } = useTranslation()
  const { updateNodeData } = useWorkflowStore()
  const config = (node.data.config as Record<string, unknown>) || {}

  const updateConfig = (key: string, value: unknown) => {
    updateNodeData(node.id, { config: { ...config, [key]: value } })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>{t("config.conditionLeft")}</Label>
        <Input value={(config.left as string) || ""} onChange={(e) => updateConfig("left", e.target.value)}
          placeholder="{{ $node.wc1.text }}" className="text-sm font-mono" />
      </div>
      <div className="space-y-2">
        <Label>{t("config.conditionOperator")}</Label>
        <Select value={(config.operator as string) || "=="} onValueChange={(v) => updateConfig("operator", v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="==">{t("config.opEquals")}</SelectItem>
            <SelectItem value="!=">{t("config.opNotEquals")}</SelectItem>
            <SelectItem value=">">{t("config.opGreater")}</SelectItem>
            <SelectItem value="<">{t("config.opLess")}</SelectItem>
            <SelectItem value=">=">{t("config.opGreaterEq")}</SelectItem>
            <SelectItem value="<=">{t("config.opLessEq")}</SelectItem>
            <SelectItem value="contains">{t("config.opContains")}</SelectItem>
            <SelectItem value="not_contains">{t("config.opNotContains")}</SelectItem>
            <SelectItem value="starts_with">{t("config.opStartsWith")}</SelectItem>
            <SelectItem value="ends_with">{t("config.opEndsWith")}</SelectItem>
            <SelectItem value="regex">{t("config.opRegex")}</SelectItem>
            <SelectItem value="is_empty">{t("config.opIsEmpty")}</SelectItem>
            <SelectItem value="is_not_empty">{t("config.opNotEmpty")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>{t("config.conditionRight")}</Label>
        <Input value={(config.right as string) || ""} onChange={(e) => updateConfig("right", e.target.value)}
          placeholder="Beijing" className="text-sm font-mono" />
      </div>
      <div className="p-3 rounded-lg bg-warning/10 dark:bg-warning/20 text-xs space-y-1">
        <p className="font-semibold">{t("config.conditionHintTrue")}</p>
        <p className="font-semibold">{t("config.conditionHintFalse")}</p>
        <p className="text-muted-foreground mt-1">{t("config.conditionHintDesc")}</p>
      </div>
    </div>
  )
}