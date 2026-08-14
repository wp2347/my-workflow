"use client"

import { useState, useRef } from "react"
import { useTranslation } from "@/i18n"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Upload } from "lucide-react"

interface PackImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported: () => Promise<void> | void
}

export function PackImportDialog({ open, onOpenChange, onImported }: PackImportDialogProps) {
  const { t } = useTranslation()
  const [text, setText] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const reset = () => { setText(""); setError(null) }

  const importManifest = async (manifest: unknown) => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/packs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(manifest),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Import failed")
      }
      onOpenChange(false)
      reset()
      await onImported()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = () => {
    try {
      const parsed = JSON.parse(text)
      importManifest(parsed)
    } catch {
      setError(t("packs.importInvalidJson"))
    }
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text())
      await importManifest(parsed)
    } catch {
      setError(t("packs.importInvalidJson"))
    }
    e.target.value = ""
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("packs.importTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Textarea
            rows={8}
            placeholder={t("packs.importPlaceholder")}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="font-mono text-xs"
          />
          <input ref={fileInputRef} type="file" accept=".json,application/json" onChange={handleFile} className="hidden" />
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-1" />
            {t("extensions.common.upload")}
          </Button>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("extensions.common.cancel")}</Button>
          <Button onClick={handleSubmit} disabled={saving || !text.trim()}>{t("packs.import")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
