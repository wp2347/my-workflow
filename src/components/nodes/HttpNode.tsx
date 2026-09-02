"use client"

import { memo } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { Globe } from "lucide-react"
import { nodeCard, nodeIcon, nodeHandle } from "@/components/nodes/nodeStyles"

function HttpNode({ data, selected }: NodeProps) {
  const config = data.config as Record<string, unknown> | undefined
  return (
    <div className={nodeCard(!!selected)}>
      <div className="flex items-center gap-2 mb-1">
        <div className={nodeIcon("http")}>
          <Globe className="h-4 w-4" />
        </div>
        <span className="text-sm font-semibold text-foreground">HTTP</span>
      </div>
      <div className="text-xs text-muted-foreground truncate max-w-[160px]">
        {config?.method ? `${config.method} ${(config.url as string || "").substring(0, 30)}` : "No URL configured"}
      </div>
      <Handle type="target" position={Position.Top} className={nodeHandle("http")} />
      <Handle type="source" position={Position.Bottom} className={nodeHandle("http")} />
    </div>
  )
}

export const HttpNodeComponent = memo(HttpNode)
