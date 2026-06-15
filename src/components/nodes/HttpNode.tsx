"use client"

import { memo } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { Globe } from "lucide-react"

function HttpNode({ data, selected }: NodeProps) {
  const config = data.config as Record<string, unknown> | undefined
  return (
    <div className={`px-4 py-3 rounded-xl border-2 bg-card shadow-sm min-w-[200px] ${selected ? "border-primary" : "border-orange-200"}`}>
      <div className="flex items-center gap-2 mb-1">
        <div className="rounded-md bg-orange-100 p-1">
          <Globe className="h-4 w-4 text-orange-600" />
        </div>
        <span className="text-sm font-semibold text-foreground">HTTP</span>
      </div>
      <div className="text-xs text-muted-foreground truncate max-w-[160px]">
        {config?.method ? `${config.method} ${(config.url as string || "").substring(0, 30)}` : "No URL configured"}
      </div>
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-orange-400 !border-2 !border-background" />
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-orange-400 !border-2 !border-background" />
    </div>
  )
}

export const HttpNodeComponent = memo(HttpNode)
