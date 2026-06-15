import { create } from "zustand"

export interface ChatMessage {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  timestamp: number
}

export interface ExecutionNodeState {
  nodeId: string
  label: string
  status: "idle" | "running" | "completed" | "failed"
  output?: string
}

interface ChatStore {
  messages: ChatMessage[]
  executionNodes: ExecutionNodeState[]
  isExecuting: boolean

  addMessage: (message: ChatMessage) => void
  clearMessages: () => void
  setExecutionNodes: (nodes: ExecutionNodeState[]) => void
  updateExecutionNode: (nodeId: string, updates: Partial<ExecutionNodeState>) => void
  setIsExecuting: (isExecuting: boolean) => void
}

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  executionNodes: [],
  isExecuting: false,

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  clearMessages: () => set({ messages: [], executionNodes: [] }),

  setExecutionNodes: (nodes) => set({ executionNodes: nodes }),

  updateExecutionNode: (nodeId, updates) =>
    set((state) => ({
      executionNodes: state.executionNodes.map((n) =>
        n.nodeId === nodeId ? { ...n, ...updates } : n
      ),
    })),

  setIsExecuting: (isExecuting) => set({ isExecuting }),
}))
