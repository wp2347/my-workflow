"use client"

import { useWorkflowStore } from "@/stores/workflow"
import { NodeConfigPanel } from "@/components/panels/NodeConfigPanel"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { useTranslation } from "@/i18n"
import { X, Info } from "lucide-react"

export function ConfigPanel() {
  const { t } = useTranslation()
  const { selectedNodeId, nodes, setSelectedNodeId } = useWorkflowStore()
  const selectedNode = nodes.find((n) => n.id === selectedNodeId)

  if (!selectedNode) {
    return (
      <div className="w-80 border-l border-border bg-card p-4 flex flex-col items-center justify-center text-center">
        <Info className="h-10 w-10 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">{t("config.selectNode")}</p>
      </div>
    )
  }

  return (
    <div className="w-80 border-l border-border bg-card flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Badge variant="outline">{selectedNode.data.type.toUpperCase()}</Badge>
          <span className="text-sm font-medium">{selectedNode.data.label}</span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedNodeId(null)}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <Separator />
      <div className="flex-1 overflow-auto">
        <NodeConfigPanel node={selectedNode} />
      </div>
    </div>
  )
}
