"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { useWorkflowStore } from "@/stores/workflow"
import { Canvas } from "@/components/canvas/Canvas"
import { NodePanel } from "@/components/canvas/NodePanel"
import { ConfigPanel } from "@/components/canvas/ConfigPanel"
import { Toolbar } from "@/components/panels/Toolbar"
import { Loader2 } from "lucide-react"

export default function WorkflowEditorPage() {
  const params = useParams()
  const workflowId = params.id as string
  const isNew = workflowId === "new"

  const {
    setWorkflowId,
    setWorkflow,
  } = useWorkflowStore()

  const [loading, setLoading] = useState(!isNew)

  useEffect(() => {
    if (isNew) {
      // Reset store for new workflow
      setWorkflow(
        { id: "", name: "未命名工作流", description: "", config: {}, createdAt: "", updatedAt: "" },
        [], [],
      )
      setWorkflowId(null)
      setLoading(false)
      return
    }

    fetch(`/api/workflow/${workflowId}`)
      .then((r) => r.json())
      .then((data) => {
        setWorkflow(
          {
            id: data.id,
            name: data.name,
            description: data.description,
            config: data.config,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          },
          (data.nodes || []).map((n: {
            id: string
            type: string
            positionX: number
            positionY: number
            data: Record<string, unknown>
          }) => ({
            id: n.id,
            type: n.type,
            position: { x: n.positionX, y: n.positionY },
            data: n.data || {},
          })),
          (data.edges || []).map((e: {
            id: string
            source: string
            target: string
            sourceHandle: string | null
            targetHandle: string | null
          }) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            sourceHandle: e.sourceHandle || undefined,
            targetHandle: e.targetHandle || undefined,
          })),
        )
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [workflowId, isNew, setWorkflowId, setWorkflow])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <Toolbar />
      <div className="flex flex-1 overflow-hidden">
        <NodePanel />
        <Canvas />
        <ConfigPanel />
      </div>
    </div>
  )
}
