"use client"

import { memo } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { Code2 } from "lucide-react"
import { nodeCard, nodeIcon, nodeHandle } from "@/components/nodes/nodeStyles"

function CodeNode({ data, selected }: NodeProps) {
  return (
    <div className={nodeCard(!!selected)}>
      <div className="flex items-center gap-2 mb-1">
        <div className={nodeIcon("code")}>
          <Code2 className="h-4 w-4" />
        </div>
        <span className="text-sm font-semibold text-foreground">Code</span>
      </div>
      <div className="text-xs text-muted-foreground">{data.label as string}</div>
      <Handle type="target" position={Position.Top} className={nodeHandle("code")} />
      <Handle type="source" position={Position.Bottom} className={nodeHandle("code")} />
    </div>
  )
}

export const CodeNodeComponent = memo(CodeNode)
