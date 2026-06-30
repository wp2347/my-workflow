"use client"

import { useState, useRef } from "react"
import { useTranslation } from "@/i18n"
import { useExtensionsStore } from "@/stores/extensions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, Plus, Upload } from "lucide-react"
import { SkillsTab } from "./SkillsTab"
import { PromptsTab } from "./PromptsTab"
import { McpTab } from "./McpTab"
import { SkillEditor } from "./SkillEditor"
import { PromptEditor } from "./PromptEditor"
import { McpEditor } from "./McpEditor"

export function ExtensionLibrary() {
  const { t } = useTranslation()
  const { activeTab, setActiveTab, searchQuery, setSearchQuery, fetchSkills, fetchPrompts, fetchMcpServers } = useExtensionsStore()

  const [editorOpen, setEditorOpen] = useState(false)
  const [editId, setEditId] = useState<string | undefined>(undefined)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const tabs = [
    { id: "skills" as const, label: t("extensions.tabs.skills") },
    { id: "prompts" as const, label: t("extensions.tabs.prompts") },
    { id: "mcp" as const, label: t("extensions.tabs.mcp") },
  ]

  const handleCreate = () => {
    setEditId(undefined)
    setEditorOpen(true)
  }

  const handleEdit = (id: string) => {
    setEditId(id)
    setEditorOpen(true)
  }

  const handleSaved = () => {
    if (activeTab === "skills") fetchSkills()
    else if (activeTab === "prompts") fetchPrompts()
    else if (activeTab === "mcp") fetchMcpServers()
  }

  const handleUpload = () => {
    fileInputRef.current?.click()
  }

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const endpoint = activeTab === "skills" ? "skills" : activeTab === "prompts" ? "prompts" : null
    if (!endpoint) return // MCP has no upload

    const formData = new FormData()
    formData.append("file", file)

    try {
      const res = await fetch(`/api/extensions/${endpoint}/upload`, { method: "POST", body: formData })
      if (res.ok) {
        handleSaved()
      } else {
        const err = await res.json()
        alert(err.error || "Upload failed")
      }
    } catch (error) {
      alert("Upload failed")
    }
    // Reset input
    e.target.value = ""
  }

  const refresh = () => {
    if (activeTab === "skills") fetchSkills()
    else if (activeTab === "prompts") fetchPrompts()
    else if (activeTab === "mcp") fetchMcpServers()
  }

  return (
    <div className="flex flex-col h-full p-6 overflow-hidden">
      <input
        ref={fileInputRef}
        type="file"
        accept=".md,.zip"
        onChange={handleFileSelected}
        className="hidden"
      />

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">{t("extensions.title")}</h1>
        <div className="flex gap-2">
          {activeTab !== "mcp" && (
            <Button variant="outline" size="sm" onClick={handleUpload}>
              <Upload className="h-4 w-4 mr-1" />
              {t("extensions.common.upload")}
            </Button>
          )}
          <Button size="sm" onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-1" />
            {t("extensions.common.create")}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <div className="flex gap-1 border-b">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex-1 max-w-xs">
          <Input
            placeholder={t("extensions.common.search")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {activeTab === "skills" && <SkillsTab onEdit={handleEdit} onRefresh={refresh} />}
        {activeTab === "prompts" && <PromptsTab onEdit={handleEdit} onRefresh={refresh} />}
        {activeTab === "mcp" && <McpTab onEdit={handleEdit} onRefresh={refresh} />}
      </div>

      {/* Editors */}
      {activeTab === "skills" && (
        <SkillEditor open={editorOpen} onOpenChange={setEditorOpen} skillId={editId} onSaved={handleSaved} />
      )}
      {activeTab === "prompts" && (
        <PromptEditor open={editorOpen} onOpenChange={setEditorOpen} promptId={editId} onSaved={handleSaved} />
      )}
      {activeTab === "mcp" && (
        <McpEditor open={editorOpen} onOpenChange={setEditorOpen} mcpId={editId} onSaved={handleSaved} />
      )}
    </div>
  )
}
