"use client"

import { memo } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { BookOpen } from "lucide-react"

function OutputNode({ data, selected }: NodeProps) {
  return (
    <div className={`px-4 py-3 rounded-xl border-2 bg-card shadow-sm min-w-[180px] ${selected ? "border-primary" : "border-green-200"}`}>
      <div className="flex items-center gap-2 mb-1">
        <div className="rounded-md bg-green-100 p-1">
          <BookOpen className="h-4 w-4 text-green-600" />
        </div>
        <span className="text-sm font-semibold text-foreground">Output</span>
      </div>
      <div className="text-xs text-muted-foreground">{data.label as string}</div>
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-green-400 !border-2 !border-background" />
    </div>
  )
}

export const OutputNodeComponent = memo(OutputNode)
