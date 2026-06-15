"use client"

import { memo } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { MessageSquare } from "lucide-react"

function InputNode({ data, selected }: NodeProps) {
  return (
    <div className={`px-4 py-3 rounded-xl border-2 bg-card shadow-sm min-w-[180px] ${selected ? "border-primary" : "border-blue-200"}`}>
      <div className="flex items-center gap-2 mb-1">
        <div className="rounded-md bg-blue-100 p-1">
          <MessageSquare className="h-4 w-4 text-blue-600" />
        </div>
        <span className="text-sm font-semibold text-foreground">Input</span>
      </div>
      <div className="text-xs text-muted-foreground">{data.label as string}</div>
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-blue-400 !border-2 !border-background" />
    </div>
  )
}

export const InputNodeComponent = memo(InputNode)
