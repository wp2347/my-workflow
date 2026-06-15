import { create } from "zustand"
import {
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  type Connection,
  type NodeChange,
  type EdgeChange,
} from "@xyflow/react"
import type { WorkflowNode, WorkflowEdge, WorkflowConfig } from "@/types/workflow"

interface WorkflowStore {
  workflowId: string | null
  workflowName: string
  workflowDescription: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  selectedNodeId: string | null
  isDirty: boolean

  setWorkflow: (config: WorkflowConfig, nodes: WorkflowNode[], edges: WorkflowEdge[]) => void
  setWorkflowId: (id: string | null) => void
  setWorkflowName: (name: string) => void
  setWorkflowDescription: (desc: string) => void
  onNodesChange: (changes: NodeChange[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onConnect: (connection: Connection) => void
  addNode: (node: WorkflowNode) => void
  updateNodeData: (nodeId: string, data: Partial<WorkflowNode["data"]>) => void
  removeNode: (nodeId: string) => void
  setSelectedNodeId: (nodeId: string | null) => void
  markClean: () => void
}

export const useWorkflowStore = create<WorkflowStore>((set, get) => ({
  workflowId: null,
  workflowName: "Untitled Workflow",
  workflowDescription: "",
  nodes: [],
  edges: [],
  selectedNodeId: null,
  isDirty: false,

  setWorkflow: (config, nodes, edges) =>
    set({
      workflowId: config.id,
      workflowName: config.name,
      workflowDescription: config.description || "",
      nodes,
      edges,
      isDirty: false,
    }),

  setWorkflowId: (id) => set({ workflowId: id }),

  setWorkflowName: (name) => set({ workflowName: name, isDirty: true }),

  setWorkflowDescription: (desc) => set({ workflowDescription: desc, isDirty: true }),

  onNodesChange: (changes) =>
    set((state) => ({
      nodes: applyNodeChanges(changes, state.nodes as never) as unknown as WorkflowNode[],
      isDirty: true,
    })),

  onEdgesChange: (changes) =>
    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges) as unknown as WorkflowEdge[],
      isDirty: true,
    })),

  onConnect: (connection) =>
    set((state) => ({
      edges: addEdge(connection, state.edges) as unknown as WorkflowEdge[],
      isDirty: true,
    })),

  addNode: (node) =>
    set((state) => ({
      nodes: [...state.nodes, node],
      isDirty: true,
    })),

  updateNodeData: (nodeId, data) =>
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
      ),
      isDirty: true,
    })),

  removeNode: (nodeId) =>
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== nodeId),
      edges: state.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
      selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId,
      isDirty: true,
    })),

  setSelectedNodeId: (nodeId) => set({ selectedNodeId: nodeId }),

  markClean: () => set({ isDirty: false }),
}))
