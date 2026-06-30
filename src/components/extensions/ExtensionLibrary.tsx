"use client"

import { useTranslation } from "@/i18n"
import { useExtensionsStore } from "@/stores/extensions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, Plus, Upload } from "lucide-react"
import { SkillsTab } from "./SkillsTab"
import { PromptsTab } from "./PromptsTab"
import { McpTab } from "./McpTab"

export function ExtensionLibrary() {
  const { t } = useTranslation()
  const { activeTab, setActiveTab, searchQuery, setSearchQuery } = useExtensionsStore()

  const tabs = [
    { id: "skills" as const, label: t("extensions.tabs.skills") },
    { id: "prompts" as const, label: t("extensions.tabs.prompts") },
    { id: "mcp" as const, label: t("extensions.tabs.mcp") },
  ]

  return (
    <div className="flex flex-col h-full p-6 overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">{t("extensions.title")}</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Upload className="h-4 w-4 mr-1" />
            {t("extensions.common.upload")}
          </Button>
          <Button size="sm">
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
        {activeTab === "skills" && <SkillsTab />}
        {activeTab === "prompts" && <PromptsTab />}
        {activeTab === "mcp" && <McpTab />}
      </div>
    </div>
  )
}
