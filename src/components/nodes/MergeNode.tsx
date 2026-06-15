"use client"

import { memo } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { Combine } from "lucide-react"

function MergeNode({ data, selected }: NodeProps) {
  return (
    <div className={`px-4 py-3 rounded-xl border-2 bg-card shadow-sm min-w-[140px] ${selected ? "border-primary" : "border-indigo-200"}`}>
      <div className="flex items-center gap-2 mb-1">
        <div className="rounded-md bg-indigo-100 p-1"><Combine className="h-4 w-4 text-indigo-600" /></div>
        <span className="text-sm font-semibold text-foreground">Merge</span>
      </div>
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-indigo-400 !border-2 !border-background" />
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-indigo-400 !border-2 !border-background" />
    </div>
  )
}

export const MergeNodeComponent = memo(MergeNode)
