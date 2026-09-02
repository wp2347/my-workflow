"use client"

import { memo } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { Combine } from "lucide-react"
import { nodeCard, nodeIcon, nodeHandle } from "@/components/nodes/nodeStyles"

function MergeNode({ data, selected }: NodeProps) {
  return (
    <div className={nodeCard(!!selected)}>
      <div className="flex items-center gap-2 mb-1">
        <div className={nodeIcon("merge")}>
          <Combine className="h-4 w-4" />
        </div>
        <span className="text-sm font-semibold text-foreground">Merge</span>
      </div>
      <Handle type="target" position={Position.Top} className={nodeHandle("merge")} />
      <Handle type="source" position={Position.Bottom} className={nodeHandle("merge")} />
    </div>
  )
}

export const MergeNodeComponent = memo(MergeNode)
