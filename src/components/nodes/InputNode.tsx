"use client"

import { memo } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { MessageSquare } from "lucide-react"
import { nodeCard, nodeIcon, nodeHandle } from "@/components/nodes/nodeStyles"

function InputNode({ data, selected }: NodeProps) {
  return (
    <div className={nodeCard(!!selected)}>
      <div className="flex items-center gap-2 mb-1">
        <div className={nodeIcon("input")}>
          <MessageSquare className="h-4 w-4" />
        </div>
        <span className="text-sm font-semibold text-foreground">Input</span>
      </div>
      <div className="text-xs text-muted-foreground">{data.label as string}</div>
      <Handle type="source" position={Position.Bottom} className={nodeHandle("input")} />
    </div>
  )
}

export const InputNodeComponent = memo(InputNode)
