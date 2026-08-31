import { create } from "zustand"

export interface RunResult {
  audioUrl?: string
  fileName: string
  metadata: Record<string, unknown>
  executionId: string
  status: string
  updatedAt: string
  // 文件产物（文档/表格/PPT 等 local 导出）
  filePath?: string
  fileSize?: number
  /** 文本类预览内容（md/txt/json），二进制类留空 */
  preview?: string
  /** kind: "audio" | "file" */
  kind?: string
}

type RunResultsMap = Record<string, Record<string, RunResult>>

const STORAGE_PREFIX = "workflow-run-results:"

function loadFromStorage(workflowId: string): Record<string, RunResult> {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${workflowId}`)
    return raw ? (JSON.parse(raw) as Record<string, RunResult>) : {}
  } catch {
    return {}
  }
}

interface RunResultsStore {
  results: RunResultsMap
  hydrate: (workflowId: string) => void
  setNodeResult: (workflowId: string, nodeId: string, result: RunResult) => void
  clearNodeResult: (workflowId: string, nodeId: string) => void
}

export const useRunResultsStore = create<RunResultsStore>((set) => ({
  results: {},

  hydrate: (workflowId) =>
    set((state) => {
      if (state.results[workflowId]) return state
      const persisted = loadFromStorage(workflowId)
      if (Object.keys(persisted).length === 0) return state
      return { results: { ...state.results, [workflowId]: persisted } }
    }),

  setNodeResult: (workflowId, nodeId, result) =>
    set((state) => {
      const wf = { ...(state.results[workflowId] || {}), [nodeId]: result }
      const next = { ...state.results, [workflowId]: wf }
      if (typeof window !== "undefined") {
        window.localStorage.setItem(`${STORAGE_PREFIX}${workflowId}`, JSON.stringify(wf))
      }
      return { results: next }
    }),

  clearNodeResult: (workflowId, nodeId) =>
    set((state) => {
      const wf = { ...(state.results[workflowId] || {}) }
      delete wf[nodeId]
      const next = { ...state.results, [workflowId]: wf }
      if (typeof window !== "undefined") {
        window.localStorage.setItem(`${STORAGE_PREFIX}${workflowId}`, JSON.stringify(wf))
      }
      return { results: next }
    }),
}))
