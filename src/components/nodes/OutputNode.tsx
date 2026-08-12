"use client"

import { memo, useEffect } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { BookOpen } from "lucide-react"
import { nodeCard, nodeIcon, nodeHandle } from "@/components/nodes/nodeStyles"
import { useWorkflowStore } from "@/stores/workflow"
import { useRunResultsStore } from "@/stores/runResults"
import { MusicPlayer } from "@/components/music/MusicPlayer"

function OutputNode({ id, data, selected }: NodeProps) {
  const workflowId = useWorkflowStore((s) => s.workflowId)
  const hydrate = useRunResultsStore((s) => s.hydrate)
  const result = useRunResultsStore((s) => (workflowId && s.results[workflowId]?.[id]) || null)

  useEffect(() => {
    if (workflowId) hydrate(workflowId)
  }, [workflowId, hydrate])

  return (
    <div className={nodeCard(!!selected)}>
      <div className="flex items-center gap-2 mb-1">
        <div className={nodeIcon("output")}>
          <BookOpen className="h-4 w-4" />
        </div>
        <span className="text-sm font-semibold text-foreground">Output</span>
      </div>
      {result ? (
        <div className="mt-1 -mx-1">
          <MusicPlayer audioUrl={result.audioUrl} fileName={result.fileName} compact />
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">{data.label as string}</div>
      )}
      <Handle type="target" position={Position.Top} className={nodeHandle("output")} />
    </div>
  )
}

export const OutputNodeComponent = memo(OutputNode)
