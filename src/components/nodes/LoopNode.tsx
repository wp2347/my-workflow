"use client"

import { memo } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { Repeat } from "lucide-react"
import { nodeCard, nodeIcon, nodeHandle } from "@/components/nodes/nodeStyles"

function LoopNode({ data, selected }: NodeProps) {
  return (
    <div className={nodeCard(!!selected)}>
      <div className="flex items-center gap-2 mb-1">
        <div className={nodeIcon("loop")}>
          <Repeat className="h-4 w-4" />
        </div>
        <span className="text-sm font-semibold text-foreground">Loop</span>
      </div>
      <div className="text-xs text-muted-foreground">{data.label as string}</div>
      <Handle type="target" position={Position.Top} className={nodeHandle("loop")} />
      <Handle type="source" position={Position.Bottom} className={nodeHandle("loop")} />
    </div>
  )
}

export const LoopNodeComponent = memo(LoopNode)
