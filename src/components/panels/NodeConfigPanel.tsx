"use client"

import { useWorkflowStore } from "@/stores/workflow"
import type { WorkflowNode } from "@/types/workflow"
import { useTranslation } from "@/i18n"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Trash2 } from "lucide-react"
import { LlmConfig } from "@/components/panels/configs/LlmConfig"
import { KnowledgeSearchConfig } from "@/components/panels/configs/KnowledgeSearchConfig"
import { CodeConfig } from "@/components/panels/configs/CodeConfig"
import { DelayConfig } from "@/components/panels/configs/DelayConfig"
import { LoopConfig } from "@/components/panels/configs/LoopConfig"
import { InputConfig } from "@/components/panels/configs/InputConfig"
import { OutputConfig } from "@/components/panels/configs/OutputConfig"
import { MusicConfig } from "@/components/panels/configs/MusicConfig"
import { HttpConfig } from "@/components/panels/configs/HttpConfig"
import { ConditionConfig } from "@/components/panels/configs/ConditionConfig"
import { MergeConfig } from "@/components/panels/configs/MergeConfig"
import { CronConfig } from "@/components/panels/configs/CronConfig"
import { FeishuConfig } from "@/components/panels/configs/FeishuConfig"

interface NodeConfigPanelProps { node: WorkflowNode }

export function NodeConfigPanel({ node }: NodeConfigPanelProps) {
  const { t } = useTranslation()
  const { updateNodeData, removeNode, setSelectedNodeId } = useWorkflowStore()
  const config = (node.data.config as Record<string, unknown>) || {}

  const updateConfig = (key: string, value: unknown) => {
    updateNodeData(node.id, { config: { ...config, [key]: value } })
  }

  const handleDelete = () => { removeNode(node.id); setSelectedNodeId(null) }

  const components: Partial<Record<string, React.FC<{ node: WorkflowNode }>>> = {
    input: InputConfig,
    llm: LlmConfig,
    output: OutputConfig,
    music: MusicConfig,
    http: HttpConfig,
    condition: ConditionConfig,
    merge: MergeConfig,
    cron_trigger: CronConfig,
    feishu: FeishuConfig,
    knowledge_search: KnowledgeSearchConfig,
    code: CodeConfig,
    delay: DelayConfig,
    loop: LoopConfig,
  }
  const ConfigComponent = components[node.data.type]

  return (
    <div className="p-4 space-y-5">
      {ConfigComponent ? <ConfigComponent key={node.id} node={node} /> : (
        <p className="text-sm text-muted-foreground">{t("config.noConfig")}</p>
      )}

      <Separator />

      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
          {t("config.retrySettings")}
        </summary>
        <div className="mt-3 space-y-3 p-2 rounded-lg bg-muted/50">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[11px]">{t("config.maxRetries")}</Label>
              <Input type="number" min={0} max={10} step={1}
                value={config.maxRetries as number ?? 0}
                onChange={(e) => updateConfig("maxRetries", parseInt(e.target.value) || 0)} />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">{t("config.retryDelay")}</Label>
              <Input type="number" min={100} max={60000} step={100}
                value={config.retryDelay as number ?? 1000}
                onChange={(e) => updateConfig("retryDelay", parseInt(e.target.value) || 1000)} />
            </div>
          </div>
        </div>
      </details>

      <Separator />
      <Button variant="destructive" size="sm" className="w-full" onClick={handleDelete}>
        <Trash2 className="h-4 w-4 mr-2" />{t("config.deleteNode")}
      </Button>
    </div>
  )
}