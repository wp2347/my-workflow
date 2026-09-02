"use client"

import { useEffect } from "react"
import { useTranslation } from "@/i18n"
import { useExtensionsStore } from "@/stores/extensions"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Download, Edit, Trash2 } from "lucide-react"

interface PromptsTabProps {
  onEdit?: (id: string) => void
  onRefresh?: () => void
}

export function PromptsTab({ onEdit, onRefresh }: PromptsTabProps) {
  const { t } = useTranslation()
  const { prompts, loading, fetchPrompts } = useExtensionsStore()

  useEffect(() => {
    fetchPrompts()
  }, [fetchPrompts])

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(t("extensions.common.confirmDelete") + ` (${name})`)) return
    try {
      const res = await fetch(`/api/extensions/prompts/${id}`, { method: "DELETE" })
      if (res.ok) {
        onRefresh?.()
      }
    } catch (error) {
      console.error("Failed to delete:", error)
    }
  }

  if (loading) return <div className="text-muted-foreground text-sm">Loading...</div>
  if (prompts.length === 0) return <div className="text-muted-foreground text-sm">{t("extensions.common.noData")}</div>

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {prompts.map((prompt) => (
        <Card key={prompt.id} className="p-4 flex flex-col gap-2">
          <div className="flex items-start justify-between">
            <h3 className="font-semibold text-sm truncate">{prompt.name}</h3>
            <div className="flex gap-1">
              {onEdit && (
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => onEdit(prompt.id)}>
                  <Edit className="h-3.5 w-3.5" />
                </Button>
              )}
              <a href={`/api/extensions/prompts/${prompt.id}/export`}>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </a>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => handleDelete(prompt.id, prompt.name)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">{prompt.description || ""}</p>
          <Badge variant="outline" className="text-xs w-fit">
            {prompt.role === "system" ? t("extensions.prompts.roleSystem") : t("extensions.prompts.roleUser")}
          </Badge>
          <div className="flex flex-wrap gap-1">
            {prompt.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
            ))}
          </div>
        </Card>
      ))}
    </div>
  )
}
