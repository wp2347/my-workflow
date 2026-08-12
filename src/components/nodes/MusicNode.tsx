"use client"

import { memo } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { Music } from "lucide-react"
import { nodeCard, nodeIcon, nodeHandle } from "@/components/nodes/nodeStyles"

function MusicNode({ data, selected }: NodeProps) {
  const config = data.config as Record<string, unknown> | undefined
  return (
    <div className={nodeCard(!!selected)}>
      <div className="flex items-center gap-2 mb-1">
        <div className={nodeIcon("music")}>
          <Music className="h-4 w-4" />
        </div>
        <span className="text-sm font-semibold text-foreground">Music</span>
      </div>
      <div className="text-xs text-muted-foreground truncate max-w-[160px]">
        {config?.apiUrl ? `${config.method || "POST"} ${(config.apiUrl as string).substring(0, 30)}` : "No API configured"}
      </div>
      <Handle type="target" position={Position.Top} className={nodeHandle("music")} />
      <Handle type="source" position={Position.Bottom} className={nodeHandle("music")} />
    </div>
  )
}

export const MusicNodeComponent = memo(MusicNode)
