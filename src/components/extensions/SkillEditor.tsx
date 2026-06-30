"use client"

import { useState, useEffect } from "react"
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
import { X, Plus } from "lucide-react"

interface SkillEditorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  skillId?: string
  onSaved?: () => void
}

interface SkillForm {
  name: string
  description: string
  category: string
  content: string
  tags: string[]
}

const EMPTY_FORM: SkillForm = {
  name: "",
  description: "",
  category: "",
  content: "",
  tags: [],
}

export function SkillEditor({ open, onOpenChange, skillId, onSaved }: SkillEditorProps) {
  const { t } = useTranslation()
  const [form, setForm] = useState<SkillForm>(EMPTY_FORM)
  const [tagInput, setTagInput] = useState("")
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    if (skillId) {
      setLoading(true)
      fetch(`/api/extensions/skills/${skillId}`)
        .then((r) => r.json())
        .then((data) => {
          setForm({
            name: data.name || "",
            description: data.description || "",
            category: data.category || "",
            content: data.content || "",
            tags: data.tags || [],
          })
        })
        .catch(console.error)
        .finally(() => setLoading(false))
    } else {
      setForm(EMPTY_FORM)
    }
  }, [open, skillId])

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

  const handleSave = async () => {
    setSaving(true)
    try {
      const body = {
        name: form.name,
        description: form.description,
        category: form.category || undefined,
        content: form.content,
        tags: form.tags,
      }
      const url = skillId
        ? `/api/extensions/skills/${skillId}`
        : "/api/extensions/skills"
      const method = skillId ? "PUT" : "POST"
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
      console.error("Failed to save skill:", error)
      alert("Save failed")
    } finally {
      setSaving(false)
    }
  }

  const nameCount = form.name.length
  const descCount = form.description.length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {skillId ? t("extensions.common.edit") : t("extensions.common.create")} — {t("extensions.tabs.skills")}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground text-sm">Loading...</div>
        ) : (
          <div className="space-y-4">
            {/* Name */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="skill-name">{t("extensions.common.name")}</Label>
                <span className="text-xs text-muted-foreground">{nameCount}/64</span>
              </div>
              <Input
                id="skill-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t("extensions.skills.namePlaceholder")}
                maxLength={64}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="skill-desc">{t("extensions.common.description")}</Label>
                <span className="text-xs text-muted-foreground">{descCount}/1024</span>
              </div>
              <Textarea
                id="skill-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder={t("extensions.skills.descPlaceholder")}
                rows={2}
                maxLength={1024}
              />
              <p className="text-xs text-muted-foreground">{t("extensions.skills.descHint")}</p>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label htmlFor="skill-category">{t("extensions.common.category")}</Label>
              <Input
                id="skill-category"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder={t("extensions.common.category")}
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

            {/* Content (SKILL.md) */}
            <div className="space-y-2">
              <Label htmlFor="skill-content">{t("extensions.skills.contentLabel")}</Label>
              <Textarea
                id="skill-content"
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                rows={12}
                className="font-mono text-sm"
                placeholder="# My Skill&#10;&#10;Instructions here..."
              />
            </div>
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
