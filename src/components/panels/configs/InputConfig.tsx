"use client"

import { useState } from "react"
import { useWorkflowStore } from "@/stores/workflow"
import type { WorkflowNode } from "@/types/workflow"
import { useTranslation } from "@/i18n"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { FolderOpen, X } from "lucide-react"
import { LocalDirPicker } from "@/components/panels/LocalDirPicker"

interface InputConfigProps { node: WorkflowNode }

export function InputConfig({ node }: InputConfigProps) {
  const { t } = useTranslation()
  const { updateNodeData } = useWorkflowStore()
  const config = (node.data.config as Record<string, unknown>) || {}
  const [dirPickerOpen, setDirPickerOpen] = useState(false)

  const updateConfig = (key: string, value: unknown) => {
    updateNodeData(node.id, { config: { ...config, [key]: value } })
  }

  const handleDirSelect = async (dir: string) => {
    try {
      await fetch("/api/fs/allow-dir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: dir }),
      })
    } catch {
      // ignore: selection still recorded
    }
    updateConfig("default", dir)
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="input-name">{t("config.variableName")}</Label>
        <Input id="input-name" value={(config.name as string) || ""} onChange={(e) => updateConfig("name", e.target.value)} placeholder="e.g. message" />
      </div>
      <div className="space-y-2">
        <Label>{t("config.type")}</Label>
        <Select value={(config.type as string) || "text"} onValueChange={(v) => updateConfig("type", v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="text">Text</SelectItem>
            <SelectItem value="number">Number</SelectItem>
            <SelectItem value="boolean">Boolean</SelectItem>
            <SelectItem value="json">JSON</SelectItem>
            <SelectItem value="file">{t("config.typeFile")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center justify-between">
        <Label htmlFor="input-required">{t("config.required")}</Label>
        <Switch id="input-required" checked={(config.required as boolean) || false} onCheckedChange={(v) => updateConfig("required", v)} />
      </div>
      {((config.type as string) || "text") === "file" ? (
        <div className="space-y-2">
          <Label>{t("config.fileSelect")}</Label>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" type="button" onClick={() => setDirPickerOpen(true)}>
              <FolderOpen className="h-3.5 w-3.5 mr-1" />
              {t("config.folderBrowse")}
            </Button>
            {(config.default as string) && (
              <Button variant="ghost" size="icon-sm" type="button" onClick={() => updateConfig("default", "")}>
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          {(config.default as string) ? (
            <div className="rounded-md bg-muted px-3 py-1.5 text-xs font-mono break-all">{config.default as string}</div>
          ) : (
            <p className="text-[10px] text-muted-foreground">{t("config.fileSelectHint")}</p>
          )}
          <LocalDirPicker open={dirPickerOpen} onOpenChange={setDirPickerOpen} onSelect={handleDirSelect} />
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="input-default">{t("config.defaultValue")}</Label>
          <Input id="input-default" value={(config.default as string) || ""} onChange={(e) => updateConfig("default", e.target.value)} placeholder="Optional" />
        </div>
      )}
    </div>
  )
}