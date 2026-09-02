"use client"

import { memo } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { Brain } from "lucide-react"
import { nodeCard, nodeIcon, nodeHandle } from "@/components/nodes/nodeStyles"

function LLMNode({ data, selected }: NodeProps) {
  const config = data.config as Record<string, unknown> | undefined
  return (
    <div className={nodeCard(!!selected)}>
      <div className="flex items-center gap-2 mb-1">
        <div className={nodeIcon("llm")}>
          <Brain className="h-4 w-4" />
        </div>
        <span className="text-sm font-semibold text-foreground">LLM</span>
      </div>
      <div className="text-xs text-muted-foreground truncate max-w-[160px]">
        {config?.model ? String(config.model) : "No model selected"}
      </div>
      <Handle type="target" position={Position.Top} className={nodeHandle("llm")} />
      <Handle type="source" position={Position.Bottom} className={nodeHandle("llm")} />
    </div>
  )
}

export const LLMNodeComponent = memo(LLMNode)
