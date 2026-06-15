"use client"

import { memo } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { Send } from "lucide-react"

function FeishuNode({ data, selected }: NodeProps) {
  return (
    <div className={`px-4 py-3 rounded-xl border-2 bg-card shadow-sm min-w-[200px] ${selected ? "border-primary" : "border-cyan-200"}`}>
      <div className="flex items-center gap-2 mb-1">
        <div className="rounded-md bg-cyan-100 p-1">
          <Send className="h-4 w-4 text-cyan-600" />
        </div>
        <span className="text-sm font-semibold text-foreground">Feishu</span>
      </div>
      <div className="text-xs text-muted-foreground truncate max-w-[160px]">
        {data.label as string}
      </div>
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-cyan-400 !border-2 !border-background" />
    </div>
  )
}

export const FeishuNodeComponent = memo(FeishuNode)
