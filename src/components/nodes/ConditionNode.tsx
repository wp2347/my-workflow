"use client"

import { memo } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { GitFork } from "lucide-react"
import { nodeCard, nodeIcon, nodeHandle } from "@/components/nodes/nodeStyles"

function ConditionNode({ data, selected }: NodeProps) {
  const config = data.config as Record<string, unknown> | undefined
  const op = (config?.operator as string) || "=="
  const left = (config?.left as string) || "value"
  const right = (config?.right as string) || ""

  return (
    <div className={nodeCard(!!selected)}>
      <div className="flex items-center gap-2 mb-1">
        <div className={nodeIcon("condition")}>
          <GitFork className="h-4 w-4" />
        </div>
        <span className="text-sm font-semibold text-foreground">IF</span>
      </div>
      <div className="text-xs text-muted-foreground truncate max-w-[160px]">
        {left.substring(0, 10)} {op} {right.substring(0, 10)}
      </div>
      <Handle type="target" position={Position.Top} className={nodeHandle("condition")} />
      <Handle type="source" position={Position.Bottom} id="true" className={`${nodeHandle("condition")} !left-[30%]`} />
      <Handle type="source" position={Position.Bottom} id="false" className={`${nodeHandle("condition")} !left-[70%]`} />
      <div className="flex justify-between text-[10px] text-muted-foreground mt-1 px-2">
        <span>TRUE</span>
        <span>FALSE</span>
      </div>
    </div>
  )
}

export const ConditionNodeComponent = memo(ConditionNode)
