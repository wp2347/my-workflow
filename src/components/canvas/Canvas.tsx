"use client"

import { useCallback, useRef } from "react"
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  type Node,
  type Edge,
  type Connection,
  BackgroundVariant,
  MarkerType,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"

import { useWorkflowStore } from "@/stores/workflow"
import { InputNodeComponent } from "@/components/nodes/InputNode"
import { LLMNodeComponent } from "@/components/nodes/LLMNode"
import { OutputNodeComponent } from "@/components/nodes/OutputNode"
import { FeishuNodeComponent } from "@/components/nodes/FeishuNode"
import { HttpNodeComponent } from "@/components/nodes/HttpNode"
import { ConditionNodeComponent } from "@/components/nodes/ConditionNode"
import { MergeNodeComponent } from "@/components/nodes/MergeNode"
import { CronTriggerNodeComponent } from "@/components/nodes/CronTriggerNode"

const nodeTypes = {
  input: InputNodeComponent,
  llm: LLMNodeComponent,
  output: OutputNodeComponent,
  feishu: FeishuNodeComponent,
  http: HttpNodeComponent,
  condition: ConditionNodeComponent,
  merge: MergeNodeComponent,
  cron_trigger: CronTriggerNodeComponent,
}

export function Canvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  )
}

function CanvasInner() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const reactFlowInstance = useReactFlow()

  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    setSelectedNodeId,
  } = useWorkflowStore()

  const handleConnect = useCallback(
    (connection: Connection) => {
      onConnect(connection)
    },
    [onConnect],
  )

  const handleClick = useCallback(() => {
    setSelectedNodeId(null)
  }, [setSelectedNodeId])

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setSelectedNodeId(node.id)
    },
    [setSelectedNodeId],
  )

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
  }, [])

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      const type = event.dataTransfer.getData("application/reactflow-type")
      const label = event.dataTransfer.getData("application/reactflow-label")

      if (!type || !reactFlowWrapper.current) return

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })

      const id = `${type}-${Date.now()}`

      addNode({
        id,
        type: type as "input" | "llm" | "output" | "feishu" | "http" | "condition" | "merge" | "cron_trigger",
        position,
        data: {
          type: type as "input" | "llm" | "output" | "feishu" | "http" | "condition" | "merge" | "cron_trigger",
          label: label || type,
          config: getDefaultConfig(type as "input" | "llm" | "output"),
        },
      })
    },
    [addNode],
  )

  return (
    <div ref={reactFlowWrapper} className="flex-1 h-full" onDragOver={handleDragOver} onDrop={handleDrop}>
      <ReactFlow
        nodes={nodes as unknown as Node[]}
        edges={edges.map((e) => ({
          ...e,
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { strokeWidth: 2, stroke: "#94a3b8" },
        })) as unknown as Edge[]}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onNodeClick={handleNodeClick}
        onPaneClick={handleClick}
        nodeTypes={nodeTypes}
        fitView
        deleteKeyCode={["Backspace", "Delete"]}
        multiSelectionKeyCode="Shift"
        defaultEdgeOptions={{
          type: "smoothstep",
          animated: true,
        }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        <Controls />
        <MiniMap
          nodeStrokeWidth={3}
          pannable
          zoomable
        />
      </ReactFlow>
    </div>
  )
}

function getDefaultConfig(type: "input" | "llm" | "output" | "feishu" | "http" | "condition" | "merge" | "cron_trigger"): Record<string, unknown> {
  switch (type) {
    case "input":
      return { name: "message", type: "text", required: true }
    case "llm":
      return {
        provider: "openai",
        model: "gpt-4o-mini",
        apiKey: "",
        baseUrl: "",
        systemPrompt: "You are a helpful assistant.",
        temperature: 0.7,
        maxTokens: 4096,
      }
    case "output":
      return { format: "text", template: "" }
    case "http":
      return { method: "GET", url: "", headers: {}, body: "", auth: "none", authUsername: "", authPassword: "", authToken: "" }
    case "condition":
      return { left: "{{ text }}", operator: "==", right: "" }
    case "merge":
      return { strategy: "concat" }
    case "cron_trigger":
      return { name: "定时任务", cronExpr: "0 9 * * *", timezone: "Asia/Shanghai", frequency: "daily" }
    case "feishu":
      return { mode: "send", appId: "", appSecret: "", verificationToken: "", webhookUrl: "", message: "", msgType: "text" }
  }
}
