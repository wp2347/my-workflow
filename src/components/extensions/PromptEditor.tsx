"use client"

import { useState, useEffect, useMemo } from "react"
import { useTranslation } from "@/i18n"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { X, Plus } from "lucide-react"

interface PromptEditorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  promptId?: string
  onSaved?: () => void
}

interface PromptVariable {
  name: string
  description?: string
  required?: boolean
  defaultValue?: string
}

interface PromptForm {
  name: string
  description: string
  category: string
  content: string
  role: string
  tags: string[]
  variables: PromptVariable[]
}

const EMPTY_FORM: PromptForm = {
  name: "",
  description: "",
  category: "",
  content: "",
  role: "system",
  tags: [],
  variables: [],
}

export function PromptEditor({ open, onOpenChange, promptId, onSaved }: PromptEditorProps) {
  const { t } = useTranslation()
  const [form, setForm] = useState<PromptForm>(EMPTY_FORM)
  const [tagInput, setTagInput] = useState("")
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    if (promptId) {
      setLoading(true)
      fetch(`/api/extensions/prompts/${promptId}`)
        .then((r) => r.json())
        .then((data) => {
          setForm({
            name: data.name || "",
            description: data.description || "",
            category: data.category || "",
            content: data.content || "",
            role: data.role || "system",
            tags: data.tags || [],
            variables: data.variables || [],
          })
        })
        .catch(console.error)
        .finally(() => setLoading(false))
    } else {
      setForm(EMPTY_FORM)
    }
  }, [open, promptId])

  const addTag = () => {
    const tag = tagInput.trim()
    if (tag && !form.tags.includes(tag)) {
      setForm({ ...form, tags: [...form.tags, tag] })
      setTagInput("")
    }
  }

  const removeTag = (tag: string) => {
    setForm({ ...form, tags: form.tags.filter((t) => t !== tag) })
  }

  const addVariable = () => {
    setForm({
      ...form,
      variables: [...form.variables, { name: "", description: "", required: false, defaultValue: "" }],
    })
  }

  const updateVariable = (index: number, field: keyof PromptVariable, value: string | boolean) => {
    const vars = [...form.variables]
    vars[index] = { ...vars[index], [field]: value }
    setForm({ ...form, variables: vars })
  }

  const removeVariable = (index: number) => {
    setForm({ ...form, variables: form.variables.filter((_, i) => i !== index) })
  }

  // Preview: replace {{varName}} with defaultValue
  const preview = useMemo(() => {
    let result = form.content
    for (const v of form.variables) {
      const placeholder = `{{${v.name}}}`
      if (result.includes(placeholder)) {
        result = result.replaceAll(placeholder, v.defaultValue || "")
      }
    }
    return result
  }, [form.content, form.variables])

  const handleSave = async () => {
    setSaving(true)
    try {
      const body = {
        name: form.name,
        description: form.description || undefined,
        category: form.category || undefined,
        content: form.content,
        role: form.role,
        tags: form.tags,
        variables: form.variables.filter((v) => v.name.trim()),
      }
      const url = promptId
        ? `/api/extensions/prompts/${promptId}`
        : "/api/extensions/prompts"
      const method = promptId ? "PUT" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        onOpenChange(false)
        onSaved?.()
      } else {
        const err = await res.json()
        alert(err.error || "Save failed")
      }
    } catch (error) {
      console.error("Failed to save prompt:", error)
      alert("Save failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {promptId ? t("extensions.common.edit") : t("extensions.common.create")} — {t("extensions.tabs.prompts")}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground text-sm">Loading...</div>
        ) : (
          <div className="space-y-4">
            {/* Name + Role */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="prompt-name">{t("extensions.common.name")}</Label>
                <Input
                  id="prompt-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder={t("extensions.prompts.namePlaceholder")}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("extensions.prompts.role")}</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v ?? "" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="system">{t("extensions.prompts.roleSystem")}</SelectItem>
                    <SelectItem value="user">{t("extensions.prompts.roleUser")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="prompt-desc">{t("extensions.common.description")}</Label>
              <Input
                id="prompt-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder={t("extensions.common.description")}
              />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label htmlFor="prompt-category">{t("extensions.common.category")}</Label>
              <Input
                id="prompt-category"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              />
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label>{t("extensions.common.tags")}</Label>
              <div className="flex gap-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag() } }}
                  placeholder={t("extensions.common.addTag")}
                  className="flex-1"
                />
                <Button type="button" variant="outline" size="sm" onClick={addTag}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1">
                {form.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    {tag}
                    <button onClick={() => removeTag(tag)} className="ml-1 hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="space-y-2">
              <Label htmlFor="prompt-content">{t("extensions.prompts.contentLabel")}</Label>
              <Textarea
                id="prompt-content"
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                rows={6}
                className="font-mono text-sm"
                placeholder="You are {{role}}. Please analyze {{topic}}..."
              />
              <p className="text-xs text-muted-foreground">{t("extensions.prompts.contentHint")}</p>
            </div>

            {/* Variables */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t("extensions.prompts.variables")}</Label>
                <Button type="button" variant="outline" size="sm" onClick={addVariable}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  {t("extensions.prompts.addVariable")}
                </Button>
              </div>
              {form.variables.length > 0 && (
                <div className="border rounded-lg divide-y">
                  {form.variables.map((v, i) => (
                    <div key={i} className="grid grid-cols-[1fr_1fr_auto_1fr_auto] gap-2 p-2 items-center">
                      <Input
                        value={v.name}
                        onChange={(e) => updateVariable(i, "name", e.target.value)}
                        placeholder={t("extensions.prompts.varName")}
                        className="h-7 text-xs"
                      />
                      <Input
                        value={v.description || ""}
                        onChange={(e) => updateVariable(i, "description", e.target.value)}
                        placeholder={t("extensions.prompts.varDesc")}
                        className="h-7 text-xs"
                      />
                      <input
                        type="checkbox"
                        checked={v.required || false}
                        onChange={(e) => updateVariable(i, "required", e.target.checked)}
                        className="h-4 w-4"
                        title={t("extensions.prompts.varRequired")}
                      />
                      <Input
                        value={v.defaultValue || ""}
                        onChange={(e) => updateVariable(i, "defaultValue", e.target.value)}
                        placeholder={t("extensions.prompts.varDefault")}
                        className="h-7 text-xs"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive"
                        onClick={() => removeVariable(i)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Preview */}
            {form.content && (
              <div className="space-y-2">
                <Label>{t("extensions.prompts.preview")}</Label>
                <div className="bg-muted/50 rounded-lg p-3 text-sm font-mono whitespace-pre-wrap">
                  {preview || "(empty)"}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("extensions.common.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? "..." : t("extensions.common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
