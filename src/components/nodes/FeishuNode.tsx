"use client"

import { memo } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { Send } from "lucide-react"
import { nodeCard, nodeIcon, nodeHandle } from "@/components/nodes/nodeStyles"

function FeishuNode({ data, selected }: NodeProps) {
  return (
    <div className={nodeCard(!!selected)}>
      <div className="flex items-center gap-2 mb-1">
        <div className={nodeIcon("feishu")}>
          <Send className="h-4 w-4" />
        </div>
        <span className="text-sm font-semibold text-foreground">Feishu</span>
      </div>
      <div className="text-xs text-muted-foreground truncate max-w-[160px]">
        {data.label as string}
      </div>
      <Handle type="target" position={Position.Top} className={nodeHandle("feishu")} />
    </div>
  )
}

export const FeishuNodeComponent = memo(FeishuNode)
