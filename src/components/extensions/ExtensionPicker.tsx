"use client"

import { useState, useEffect } from "react"
import { useTranslation } from "@/i18n"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Plus, X, Package } from "lucide-react"
import type { ExtensionBindings, McpBinding } from "@/types/workflow"

interface ExtensionPickerProps {
  value: ExtensionBindings
  onChange: (value: ExtensionBindings) => void
}

export function ExtensionPicker({ value, onChange }: ExtensionPickerProps) {
  const { t } = useTranslation()
  const [pickerType, setPickerType] = useState<"skills" | "prompts" | "mcp" | null>(null)

  const updateSkills = (ids: string[]) => {
    onChange({ ...value, skills: ids })
  }

  const updatePrompts = (ids: string[]) => {
    onChange({ ...value, prompts: ids })
  }

  const updateMcp = (bindings: McpBinding[]) => {
    onChange({ ...value, mcp: bindings })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        <Package className="h-3.5 w-3.5" />
        {t("extensions.picker.title")}
      </div>

      {/* Skills */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="text-xs">{t("extensions.tabs.skills")}</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 text-xs"
            onClick={() => setPickerType("skills")}
          >
            <Plus className="h-3 w-3 mr-1" />
            {t("extensions.picker.addSkill")}
          </Button>
        </div>
        <div className="flex flex-wrap gap-1">
          {value.skills.map((id) => (
            <SkillBadge key={id} id={id} onRemove={() => updateSkills(value.skills.filter((s) => s !== id))} />
          ))}
          {value.skills.length === 0 && (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </div>
      </div>

      {/* Prompts */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="text-xs">{t("extensions.tabs.prompts")}</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 text-xs"
            onClick={() => setPickerType("prompts")}
          >
            <Plus className="h-3 w-3 mr-1" />
            {t("extensions.picker.addPrompt")}
          </Button>
        </div>
        <div className="flex flex-wrap gap-1">
          {value.prompts.map((id) => (
            <PromptBadge key={id} id={id} onRemove={() => updatePrompts(value.prompts.filter((p) => p !== id))} />
          ))}
          {value.prompts.length === 0 && (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </div>
      </div>

      {/* MCP */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="text-xs">{t("extensions.tabs.mcp")}</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 text-xs"
            onClick={() => setPickerType("mcp")}
          >
            <Plus className="h-3 w-3 mr-1" />
            {t("extensions.picker.addMcp")}
          </Button>
        </div>
        <div className="flex flex-wrap gap-1">
          {value.mcp.map((binding) => (
            <McpBadge
              key={binding.serverId}
              binding={binding}
              onRemove={() => updateMcp(value.mcp.filter((m) => m.serverId !== binding.serverId))}
            />
          ))}
          {value.mcp.length === 0 && (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </div>
      </div>

      {/* Picker Dialog */}
      {pickerType && (
        <PickerDialog
          type={pickerType}
          selectedIds={pickerType === "mcp" ? value.mcp.map((m) => m.serverId) : (pickerType === "skills" ? value.skills : value.prompts)}
          onConfirm={(ids) => {
            if (pickerType === "skills") updateSkills(ids)
            else if (pickerType === "prompts") updatePrompts(ids)
            else if (pickerType === "mcp") {
              const existing = new Map(value.mcp.map((m) => [m.serverId, m]))
              const newBindings = ids.map((id) => existing.get(id) || { serverId: id, tools: "all" as const, resources: [], prompts: [] })
              updateMcp(newBindings)
            }
            setPickerType(null)
          }}
          onCancel={() => setPickerType(null)}
        />
      )}
    </div>
  )
}

// Need to import Label
import { Label } from "@/components/ui/label"

// --- Sub components ---

function SkillBadge({ id, onRemove }: { id: string; onRemove: () => void }) {
  const [name, setName] = useState(id)
  useEffect(() => {
    fetch(`/api/extensions/skills/${id}`).then((r) => r.json()).then((d) => setName(d.name || id)).catch(() => {})
  }, [id])
  return (
    <Badge variant="secondary" className="gap-1 text-xs">
      {name}
      <button onClick={onRemove} className="ml-1 hover:text-destructive"><X className="h-3 w-3" /></button>
    </Badge>
  )
}

function PromptBadge({ id, onRemove }: { id: string; onRemove: () => void }) {
  const [name, setName] = useState(id)
  useEffect(() => {
    fetch(`/api/extensions/prompts/${id}`).then((r) => r.json()).then((d) => setName(d.name || id)).catch(() => {})
  }, [id])
  return (
    <Badge variant="secondary" className="gap-1 text-xs">
      {name}
      <button onClick={onRemove} className="ml-1 hover:text-destructive"><X className="h-3 w-3" /></button>
    </Badge>
  )
}

function McpBadge({ binding, onRemove }: { binding: McpBinding; onRemove: () => void }) {
  const [name, setName] = useState(binding.serverId)
  useEffect(() => {
    fetch(`/api/extensions/mcp/${binding.serverId}`).then((r) => r.json()).then((d) => setName(d.name || binding.serverId)).catch(() => {})
  }, [binding.serverId])
  const toolsLabel = binding.tools === "all" ? "all" : (binding.tools || []).join(",")
  return (
    <Badge variant="secondary" className="gap-1 text-xs">
      {name}({toolsLabel})
      <button onClick={onRemove} className="ml-1 hover:text-destructive"><X className="h-3 w-3" /></button>
    </Badge>
  )
}

// --- Picker Dialog ---

interface PickerDialogProps {
  type: "skills" | "prompts" | "mcp"
  selectedIds: string[]
  onConfirm: (ids: string[]) => void
  onCancel: () => void
}

function PickerDialog({ type, selectedIds, onConfirm, onCancel }: PickerDialogProps) {
  const { t } = useTranslation()
  const [items, setItems] = useState<Array<{ id: string; name: string; description?: string }>>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedIds))

  useEffect(() => {
    const endpoint = type === "skills" ? "skills" : type === "prompts" ? "prompts" : "mcp"
    setLoading(true)
    fetch(`/api/extensions/${endpoint}`)
      .then((r) => r.json())
      .then((data) => setItems(data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [type])

  const toggle = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  const filtered = search
    ? items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()) || (i.description || "").toLowerCase().includes(search.toLowerCase()))
    : items

  const title = type === "skills" ? t("extensions.picker.selectSkills") : type === "prompts" ? t("extensions.picker.selectPrompts") : t("extensions.picker.selectMcp")

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel() }}>
      <DialogContent className="max-w-lg max-h-[70vh]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <Input
          placeholder={t("extensions.common.search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-2"
        />
        <div className="max-h-[40vh] overflow-y-auto space-y-1">
          {loading ? (
            <div className="text-center text-muted-foreground text-sm py-4">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-4">{t("extensions.common.noData")}</div>
          ) : (
            filtered.map((item) => (
              <div
                key={item.id}
                onClick={() => toggle(item.id)}
                className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                  selected.has(item.id) ? "bg-primary/10 border border-primary/30" : "hover:bg-muted"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(item.id)}
                  onChange={() => toggle(item.id)}
                  className="h-4 w-4"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{item.name}</div>
                  {item.description && (
                    <div className="text-xs text-muted-foreground truncate">{item.description}</div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onCancel}>{t("extensions.common.cancel")}</Button>
          <Button size="sm" onClick={() => onConfirm([...selected])}>{t("extensions.common.save")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
