import { create } from "zustand"

export interface SkillItem {
  id: string
  name: string
  description: string
  category?: string
  tags: string[]
  packId?: string
  updatedAt: string
}

export interface PromptItem {
  id: string
  name: string
  description?: string
  category?: string
  role: string
  tags: string[]
  packId?: string
  updatedAt: string
}

export interface McpItem {
  id: string
  name: string
  description?: string
  transport: string
  status: string
  url?: string
  command?: string
  hasAuth: boolean
  tags: string[]
  packId?: string
  updatedAt: string
}

type TabType = "skills" | "prompts" | "mcp"

interface ExtensionsStore {
  activeTab: TabType
  skills: SkillItem[]
  prompts: PromptItem[]
  mcpServers: McpItem[]
  loading: boolean
  searchQuery: string

  setActiveTab: (tab: TabType) => void
  setSearchQuery: (q: string) => void
  setSkills: (items: SkillItem[]) => void
  setPrompts: (items: PromptItem[]) => void
  setMcpServers: (items: McpItem[]) => void
  setLoading: (loading: boolean) => void

  fetchSkills: () => Promise<void>
  fetchPrompts: () => Promise<void>
  fetchMcpServers: () => Promise<void>
}

export const useExtensionsStore = create<ExtensionsStore>((set, get) => ({
  activeTab: "skills",
  skills: [],
  prompts: [],
  mcpServers: [],
  loading: false,
  searchQuery: "",

  setActiveTab: (tab) => set({ activeTab: tab }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setSkills: (items) => set({ skills: items }),
  setPrompts: (items) => set({ prompts: items }),
  setMcpServers: (items) => set({ mcpServers: items }),
  setLoading: (loading) => set({ loading }),

  fetchSkills: async () => {
    set({ loading: true })
    try {
      const q = get().searchQuery
      const res = await fetch(`/api/extensions/skills?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      set({ skills: data })
    } catch (error) {
      console.error("Failed to fetch skills:", error)
    } finally {
      set({ loading: false })
    }
  },

  fetchPrompts: async () => {
    set({ loading: true })
    try {
      const q = get().searchQuery
      const res = await fetch(`/api/extensions/prompts?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      set({ prompts: data })
    } catch (error) {
      console.error("Failed to fetch prompts:", error)
    } finally {
      set({ loading: false })
    }
  },

  fetchMcpServers: async () => {
    set({ loading: true })
    try {
      const q = get().searchQuery
      const res = await fetch(`/api/extensions/mcp?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      set({ mcpServers: data })
    } catch (error) {
      console.error("Failed to fetch MCP servers:", error)
    } finally {
      set({ loading: false })
    }
  },
}))
