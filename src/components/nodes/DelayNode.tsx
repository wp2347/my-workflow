"use client"

import { memo } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { Hourglass } from "lucide-react"
import { nodeCard, nodeIcon, nodeHandle } from "@/components/nodes/nodeStyles"

function DelayNode({ data, selected }: NodeProps) {
  return (
    <div className={nodeCard(!!selected)}>
      <div className="flex items-center gap-2 mb-1">
        <div className={nodeIcon("delay")}>
          <Hourglass className="h-4 w-4" />
        </div>
        <span className="text-sm font-semibold text-foreground">Delay</span>
      </div>
      <div className="text-xs text-muted-foreground">{data.label as string}</div>
      <Handle type="target" position={Position.Top} className={nodeHandle("delay")} />
      <Handle type="source" position={Position.Bottom} className={nodeHandle("delay")} />
    </div>
  )
}

export const DelayNodeComponent = memo(DelayNode)
