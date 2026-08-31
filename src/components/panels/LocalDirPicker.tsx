"use client"

import { useState, useEffect, useCallback } from "react"
import { useTranslation } from "@/i18n"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { FolderOpen, FileText, Loader2, HardDrive, ChevronRight, Home, Monitor, Download, File } from "lucide-react"

interface FsEntry {
  name: string
  path: string
  size: number
  isDir: boolean
  mtime: number
}

interface FsListing {
  path: string | null
  parent: string | null
  drives: FsEntry[]
  entries: FsEntry[]
  home?: string
}

interface LocalDirPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (dir: string) => Promise<void> | void
}

const LAST_DIR_KEY = "workflow-fs-last-dir"

/** 把路径拆成面包屑片段（兼容 / 与 \ 分隔符） */
function pathParts(p: string): Array<{ label: string; path: string }> {
  if (!p) return []
  const sep = p.includes("\\") ? "\\" : "/"
  const parts = p.split(sep).filter(Boolean)
  const out: Array<{ label: string; path: string }> = []
  let acc = ""
  for (const part of parts) {
    acc = acc ? `${acc}${sep}${part}` : (sep === "\\" ? `${part}${sep}` : `${sep}${part}`)
    out.push({ label: part, path: acc })
  }
  // 根目录占位
  if (sep === "/") out.unshift({ label: "/", path: "/" })
  return out
}

/** 人类可读的文件大小 */
function formatSize(bytes: number): string {
  if (!bytes) return "—"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
}

function formatMtime(mtime: number): string {
  if (!mtime) return "—"
  const d = new Date(mtime)
  const now = new Date()
  const sameYear = d.getFullYear() === now.getFullYear()
  const ymd = `${d.getMonth() + 1}/${d.getDate()}`
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
  return sameYear ? `${ymd} ${hm}` : `${d.getFullYear()}/${ymd} ${hm}`
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
      const data = await res.json() as FsListing
      setListing(data)
      setSelectedPath(null)
      // 记住最近访问的目录（顶层盘符视图 path 为 null，不保存）
      if (data?.path) {
        try { localStorage.setItem(LAST_DIR_KEY, data.path) } catch {}
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      // 记忆的目录已不可访问时清除，下次回到默认起始目录
      if (dir) {
        try { localStorage.removeItem(LAST_DIR_KEY) } catch {}
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    let last: string | null = null
    try { last = localStorage.getItem(LAST_DIR_KEY) } catch {}
    // 延迟到下一宏任务，避免在 effect 内同步 setState
    const timer = setTimeout(() => { void load(last || "") }, 0)
    return () => clearTimeout(timer)
  }, [open, load])

  const handleConfirm = useCallback(async (targetOverride?: string) => {
    // 选中的文件优先；否则取当前目录
    const target = targetOverride ?? selectedPath ?? listing?.path
    if (!target) return
    setSaving(true)
    try {
      await onSelect(target)
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }, [selectedPath, listing?.path, onSelect, onOpenChange])

  const quickAccess = listing?.home
    ? [
        { label: t("config.fsHome"), path: listing.home, icon: <Home className="h-4 w-4" /> },
        { label: t("config.fsDesktop"), path: `${listing.home}/Desktop`, icon: <Monitor className="h-4 w-4" /> },
        { label: t("config.fsDownloads"), path: `${listing.home}/Downloads`, icon: <Download className="h-4 w-4" /> },
        { label: t("config.fsDocuments"), path: `${listing.home}/Documents`, icon: <File className="h-4 w-4" /> },
      ]
    : []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("config.fileBrowseTitle")}</DialogTitle>
        </DialogHeader>

        {/* 面包屑导航 */}
        {listing?.path && (
          <div className="flex items-center gap-0.5 flex-wrap rounded-md border border-border bg-muted/50 px-2 py-1.5">
            {pathParts(listing.path).map((part, idx, arr) => (
              <span key={part.path} className="flex items-center gap-0.5 min-w-0">
                {idx > 0 && <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />}
                {idx === arr.length - 1 ? (
                  <span className="px-1 text-xs font-medium text-foreground truncate max-w-[160px]">{part.label}</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => load(part.path)}
                    className="px-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors truncate max-w-[160px]"
                  >
                    {part.label}
                  </button>
                )}
              </span>
            ))}
          </div>
        )}

        <div className="flex gap-3 min-h-0">
          {/* 快速访问侧栏 */}
          {quickAccess.length > 0 && (
            <div className="w-40 shrink-0 space-y-1 pr-2 border-r border-border">
              <div className="text-[11px] font-semibold text-muted-foreground mb-1">{t("config.fsSidebar")}</div>
              {quickAccess.map((qa) => (
                <button
                  key={qa.path}
                  type="button"
                  onClick={() => load(qa.path)}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-left transition-colors ${listing?.path === qa.path ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                >
                  {qa.icon}
                  <span className="truncate">{qa.label}</span>
                </button>
              ))}
              {listing?.drives.length ? (
                <div className="pt-2 space-y-1">
                  {listing.drives.map((d) => (
                    <button
                      key={d.path}
                      type="button"
                      onClick={() => load(d.path)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      <HardDrive className="h-4 w-4" />
                      <span className="truncate">{d.name}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          )}

          {/* 文件列表 */}
          <div className="flex-1 min-w-0">
            <div className="grid grid-cols-[1fr_90px_140px] gap-2 px-3 py-1.5 border-b border-border text-[11px] text-muted-foreground font-medium">
              <span>{t("config.fsName")}</span>
              <span className="text-right">{t("config.fsSize")}</span>
              <span className="text-right">{t("config.fsModified")}</span>
            </div>

            <div className="max-h-[40vh] overflow-y-auto rounded-b-lg">
              {loading ? (
                <div className="flex items-center justify-center py-10 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {t("config.folderLoading")}
                </div>
              ) : error ? (
                <div className="px-3 py-4 text-xs text-destructive">{error}</div>
              ) : (listing?.entries.length ?? 0) === 0 ? (
                <div className="px-3 py-4 text-xs text-muted-foreground">{t("config.folderEmpty")}</div>
              ) : (
                <>
                  {listing?.entries.map((entry) => {
                    const isSelected = selectedPath === entry.path
                    return (
                      <button
                        key={entry.path}
                        type="button"
                        onClick={() => setSelectedPath(isSelected ? null : entry.path)}
                        onDoubleClick={() => {
                          if (entry.isDir) load(entry.path)
                          else handleConfirm(entry.path)
                        }}
                        className={`grid grid-cols-[1fr_90px_140px] gap-2 w-full px-3 py-1.5 text-sm text-left items-center transition-colors ${isSelected ? "bg-primary/10 ring-1 ring-primary/40" : "hover:bg-muted"}`}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          {entry.isDir ? (
                            <FolderOpen className="h-4 w-4 shrink-0 text-warning" />
                          ) : (
                            <FileText className={`h-4 w-4 shrink-0 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                          )}
                          <span className="truncate">{entry.name}</span>
                        </span>
                        <span className="text-xs text-muted-foreground text-right truncate">{entry.isDir ? "—" : formatSize(entry.size)}</span>
                        <span className="text-xs text-muted-foreground text-right truncate">{formatMtime(entry.mtime)}</span>
                      </button>
                    )
                  })}
                </>
              )}
            </div>

            {listing?.entries.length ? (
              <div className="px-3 py-1.5 text-[11px] text-muted-foreground">
                {t("config.fsItems", { count: listing.entries.length })}
              </div>
            ) : null}
          </div>
        </div>

        {selectedPath && (
          <div className="flex items-center gap-2 rounded-md bg-primary/10 px-3 py-1.5 text-xs font-mono break-all text-foreground">
            <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span>{selectedPath}</span>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("extensions.common.cancel")}</Button>
          <Button onClick={() => handleConfirm()} disabled={!listing?.path || saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
            {selectedPath ? t("config.fileChoose") : t("config.folderChoose")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
