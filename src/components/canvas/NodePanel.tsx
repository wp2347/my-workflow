"use client"

import { type DragEvent } from "react"
import { Card } from "@/components/ui/card"
import { MessageSquare, Brain, BookOpen, Send, Globe, GitFork, Combine, Timer, ArrowRight, Music, DatabaseZap, Code2, Hourglass, Repeat } from "lucide-react"
import { type NodeType } from "@/types/workflow"
import { useTranslation } from "@/i18n"

const iconMap: Record<NodeType, React.ReactNode> = {
  input: <MessageSquare className="h-4 w-4" />,
  llm: <Brain className="h-4 w-4" />,
  output: <BookOpen className="h-4 w-4" />,
  feishu: <Send className="h-4 w-4" />,
  http: <Globe className="h-4 w-4" />,
  condition: <GitFork className="h-4 w-4" />,
  merge: <Combine className="h-4 w-4" />,
  cron_trigger: <Timer className="h-4 w-4" />,
  music: <Music className="h-4 w-4" />,
  knowledge_search: <DatabaseZap className="h-4 w-4" />,
  code: <Code2 className="h-4 w-4" />,
  delay: <Hourglass className="h-4 w-4" />,
  loop: <Repeat className="h-4 w-4" />,
}

export function NodePanel() {
  const { t } = useTranslation()

  const nodeList: { type: NodeType; label: string; description: string }[] = [
    { type: "input", label: t("canvas.input"), description: t("canvas.inputDesc") },
    { type: "llm", label: t("canvas.llm"), description: t("canvas.llmDesc") },
    { type: "output", label: t("canvas.output"), description: t("canvas.outputDesc") },
    { type: "feishu", label: t("canvas.feishu"), description: t("canvas.feishuDesc") },
    { type: "http", label: t("canvas.http"), description: t("canvas.httpDesc") },
    { type: "condition", label: t("canvas.condition"), description: t("canvas.conditionDesc") },
    { type: "merge", label: t("canvas.merge"), description: t("canvas.mergeDesc") },
    { type: "cron_trigger", label: t("canvas.cronTrigger"), description: t("canvas.cronTriggerDesc") },
    { type: "music", label: t("canvas.music"), description: t("canvas.musicDesc") },
    { type: "knowledge_search", label: t("canvas.knowledgeSearch"), description: t("canvas.knowledgeSearchDesc") },
    { type: "code", label: t("canvas.code"), description: t("canvas.codeDesc") },
    { type: "delay", label: t("canvas.delay"), description: t("canvas.delayDesc") },
    { type: "loop", label: t("canvas.loop"), description: t("canvas.loopDesc") },
  ]

  const handleDragStart = (event: DragEvent, type: NodeType, label: string) => {
    event.dataTransfer.setData("application/reactflow-type", type)
    event.dataTransfer.setData("application/reactflow-label", label)
    event.dataTransfer.effectAllowed = "move"
  }

  return (
    <div className="w-56 border-r border-border bg-card p-4 flex flex-col gap-2 h-full min-h-0">
      <h3 className="text-sm font-semibold text-muted-foreground shrink-0">
        {t("canvas.nodes")}
      </h3>
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2 pr-0.5">
        {nodeList.map((node) => (
          <Card
            key={node.type}
            draggable
            onDragStart={(e) => handleDragStart(e, node.type, node.label)}
            className="p-3 cursor-grab active:cursor-grabbing hover:border-primary transition-colors shrink-0"
          >
            <div className="flex items-center gap-2">
              <div className="flex-shrink-0 text-primary">{iconMap[node.type]}</div>
              <div>
                <div className="text-sm font-medium">{node.label}</div>
                <div className="text-xs text-muted-foreground">{node.description}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="pt-4 border-t border-border shrink-0">
        <div className="text-xs text-muted-foreground space-y-1">
          <div className="flex items-center gap-1">
            <ArrowRight className="h-3 w-3" />{t("canvas.dragTips.drag")}
          </div>
          <div className="flex items-center gap-1">
            <ArrowRight className="h-3 w-3" />{t("canvas.dragTips.connect")}
          </div>
          <div className="flex items-center gap-1">
            <ArrowRight className="h-3 w-3" />{t("canvas.dragTips.click")}
          </div>
        </div>
      </div>
    </div>
  )
}
