"use client"

import { memo } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { GitFork } from "lucide-react"

function ConditionNode({ data, selected }: NodeProps) {
  const config = data.config as Record<string, unknown> | undefined
  const op = (config?.operator as string) || "=="
  const left = (config?.left as string) || "value"
  const right = (config?.right as string) || ""

  return (
    <div className={`px-4 py-3 rounded-xl border-2 bg-card shadow-sm min-w-[180px] ${selected ? "border-primary" : "border-yellow-200"}`}>
      <div className="flex items-center gap-2 mb-1">
        <div className="rounded-md bg-yellow-100 p-1">
          <GitFork className="h-4 w-4 text-yellow-600" />
        </div>
        <span className="text-sm font-semibold text-foreground">IF</span>
      </div>
      <div className="text-xs text-muted-foreground truncate max-w-[160px]">
        {left.substring(0, 10)} {op} {right.substring(0, 10)}
      </div>
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-yellow-400 !border-2 !border-background" />
      <Handle type="source" position={Position.Bottom} id="true" className="!w-3 !h-3 !bg-green-400 !border-2 !border-background !left-[30%]" />
      <Handle type="source" position={Position.Bottom} id="false" className="!w-3 !h-3 !bg-red-400 !border-2 !border-background !left-[70%]" />
      <div className="flex justify-between text-[10px] text-muted-foreground mt-1 px-2">
        <span>TRUE</span>
        <span>FALSE</span>
      </div>
    </div>
  )
}

export const ConditionNodeComponent = memo(ConditionNode)
