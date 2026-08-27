"use client"

import { useWorkflowStore } from "@/stores/workflow"
import type { WorkflowNode } from "@/types/workflow"
import { useTranslation } from "@/i18n"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface CodeConfigProps { node: WorkflowNode }

export function CodeConfig({ node }: CodeConfigProps) {
  const { t } = useTranslation()
  const { updateNodeData } = useWorkflowStore()
  const config = (node.data.config as Record<string, unknown>) || {}

  const updateConfig = (key: string, value: unknown) => {
    updateNodeData(node.id, { config: { ...config, [key]: value } })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="code-script">{t("config.codeScript")}</Label>
        <Textarea id="code-script" value={(config.code as string) || ""} onChange={(e) => updateConfig("code", e.target.value)}
          placeholder={"return items.map(x => x.toUpperCase())"} rows={8} className="text-sm font-mono" />
        <p className="text-[10px] text-muted-foreground">{t("config.codeScriptHint")}</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="code-timeout" className="text-xs text-muted-foreground">{t("config.codeTimeout")}</Label>
        <Input id="code-timeout" type="number" min={50} max={30000} step={50} value={(config.timeoutMs as number) ?? 3000}
          onChange={(e) => {
            const n = parseInt(e.target.value)
            if (!isNaN(n)) updateConfig("timeoutMs", Math.min(Math.max(n, 50), 30000))
          }} />
        <p className="text-[10px] text-muted-foreground">{t("config.codeTimeoutHint")}</p>
      </div>
      <div className="p-3 rounded-lg bg-node-code-bg text-xs text-muted-foreground">
        {t("config.codeSandboxHint")}
      </div>
    </div>
  )
}
