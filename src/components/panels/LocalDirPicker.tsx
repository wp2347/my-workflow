"use client"

import { useState, useEffect, useCallback } from "react"
import { useTranslation } from "@/i18n"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { FolderOpen, FileText, ArrowUp, Loader2, HardDrive } from "lucide-react"

interface FsEntry {
  name: string
  path: string
  size: number
  isDir: boolean
}

interface FsListing {
  path: string | null
  parent: string | null
  drives: FsEntry[]
  entries: FsEntry[]
}

interface LocalDirPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (dir: string) => Promise<void> | void
}

export function LocalDirPicker({ open, onOpenChange, onSelect }: LocalDirPickerProps) {
  const { t } = useTranslation()
  const [listing, setListing] = useState<FsListing | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)

  const load = useCallback(async (dir: string) => {
    setLoading(true)
    setError(null)
    try {
      const q = dir ? `?path=${encodeURIComponent(dir)}` : ""
      const res = await fetch(`/api/fs/list${q}`)
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to list")
      }
      setListing(await res.json())
      setSelectedPath(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) load("")
  }, [open, load])

  const handleConfirm = async () => {
    // 选中的文件优先；否则取当前目录
    const target = selectedPath ?? listing?.path
    if (!target) return
    setSaving(true)
    try {
      await onSelect(target)
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("config.fileBrowseTitle")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-1.5 text-xs font-mono text-muted-foreground break-all">
            <HardDrive className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{listing?.path ?? "/"}</span>
          </div>

          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              disabled={!listing?.parent}
              onClick={() => listing?.parent && load(listing.parent)}
            >
              <ArrowUp className="h-3.5 w-3.5 mr-1" />
              {t("config.folderUp")}
            </Button>
            <span className="text-xs text-muted-foreground">
              {selectedPath ? t("config.fileSelectedHint") : t("config.folderSelectHint")}
            </span>
          </div>

          {selectedPath && (
            <div className="flex items-center gap-2 rounded-md bg-primary/10 px-3 py-1.5 text-xs font-mono break-all text-foreground">
              <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span>{selectedPath}</span>
            </div>
          )}

          {listing?.drives.length ? (
            <div className="flex flex-wrap gap-1.5">
              {listing.drives.map((d) => (
                <button
                  key={d.path}
                  type="button"
                  onClick={() => load(d.path)}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-muted transition-colors"
                >
                  <HardDrive className="h-3.5 w-3.5" />
                  {d.name}
                </button>
              ))}
            </div>
          ) : null}

          <div className="max-h-[40vh] overflow-y-auto rounded-lg border border-border divide-y divide-border">
            {loading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {t("config.folderLoading")}
              </div>
            ) : error ? (
              <div className="px-3 py-4 text-xs text-destructive">{error}</div>
            ) : (listing?.entries.length ?? 0) === 0 ? (
              <div className="px-3 py-4 text-xs text-muted-foreground">{t("config.folderEmpty")}</div>
            ) : (
              listing?.entries.map((entry) => {
                const isSelected = selectedPath === entry.path
                return (
                  <button
                    key={entry.path}
                    type="button"
                    onClick={() => {
                      if (entry.isDir) load(entry.path)
                      else setSelectedPath(isSelected ? null : entry.path)
                    }}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${isSelected ? "bg-primary/10 ring-1 ring-primary/40" : "hover:bg-muted"}`}
                  >
                    {entry.isDir ? (
                      <FolderOpen className="h-4 w-4 shrink-0 text-warning" />
                    ) : (
                      <FileText className={`h-4 w-4 shrink-0 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                    )}
                    <span className="truncate">{entry.name}</span>
                  </button>
                )
              })
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("extensions.common.cancel")}</Button>
          <Button onClick={handleConfirm} disabled={!listing?.path || saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
            {selectedPath ? t("config.fileChoose") : t("config.folderChoose")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
