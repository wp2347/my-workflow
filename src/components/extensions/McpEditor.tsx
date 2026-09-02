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
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Circle, Plus, X, Zap } from "lucide-react"

interface McpEditorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mcpId?: string
  onSaved?: () => void
}

interface McpForm {
  name: string
  description: string
  transport: string
  url: string
  command: string
  args: string
  env: string
  headers: string
  tags: string[]
}

const EMPTY_FORM: McpForm = {
  name: "",
  description: "",
  transport: "http",
  url: "",
  command: "",
  args: "",
  env: "",
  headers: "",
  tags: [],
}

export function McpEditor({ open, onOpenChange, mcpId, onSaved }: McpEditorProps) {
  const { t } = useTranslation()
  const [form, setForm] = useState<McpForm>(EMPTY_FORM)
  const [tagInput, setTagInput] = useState("")
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ status: string; error?: string; capabilities?: { tools: unknown[]; resources: unknown[]; prompts: unknown[] } } | null>(null)

  useEffect(() => {
    if (!open) return
    setTestResult(null)
    if (mcpId) {
      setLoading(true)
      fetch(`/api/extensions/mcp/${mcpId}`)
        .then((r) => r.json())
        .then((data) => {
          setForm({
            name: data.name || "",
            description: data.description || "",
            transport: data.transport || "http",
            url: data.url || "",
            command: data.command || "",
            args: Array.isArray(data.args) ? data.args.join(", ") : "",
            env: "",
            headers: "",
            tags: data.tags || [],
          })
        })
        .catch(console.error)
        .finally(() => setLoading(false))
    } else {
      setForm(EMPTY_FORM)
    }
  }, [open, mcpId])

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

  const parseHeaders = () => {
    try {
      return form.headers.trim() ? JSON.parse(form.headers) : undefined
    } catch {
      return undefined
    }
  }

  const parseEnv = () => {
    try {
      return form.env.trim() ? JSON.parse(form.env) : undefined
    } catch {
      return undefined
    }
  }

  const parseArgs = () => {
    return form.args.trim()
      ? form.args.split(",").map((a) => a.trim()).filter(Boolean)
      : []
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        name: form.name,
        description: form.description || undefined,
        transport: form.transport,
        tags: form.tags,
      }
      if (form.transport === "http" || form.transport === "sse") {
        body.url = form.url
        const headers = parseHeaders()
        if (headers) body.headers = headers
      } else if (form.transport === "stdio") {
        body.command = form.command
        body.args = parseArgs()
        const env = parseEnv()
        if (env) body.env = env
      }

      const url = mcpId ? `/api/extensions/mcp/${mcpId}` : "/api/extensions/mcp"
      const method = mcpId ? "PUT" : "POST"
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
      console.error("Failed to save MCP:", error)
      alert("Save failed")
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    if (!mcpId) {
      alert("Please save first before testing")
      return
    }
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch(`/api/extensions/mcp/${mcpId}/test`, { method: "POST" })
      const data = await res.json()
      setTestResult(data)
    } catch (error) {
      setTestResult({ status: "error", error: String(error) })
    } finally {
      setTesting(false)
    }
  }

  const statusColor: Record<string, string> = {
    online: "text-success",
    offline: "text-muted-foreground",
    error: "text-destructive",
    untested: "text-warning",
    checking: "text-info",
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mcpId ? t("extensions.common.edit") : t("extensions.common.create")} — {t("extensions.tabs.mcp")}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground text-sm">Loading...</div>
        ) : (
          <div className="space-y-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="mcp-name">{t("extensions.common.name")}</Label>
              <Input
                id="mcp-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="My MCP Server"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="mcp-desc">{t("extensions.common.description")}</Label>
              <Input
                id="mcp-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            {/* Transport */}
            <div className="space-y-2">
              <Label>{t("extensions.mcp.transport")}</Label>
              <Select value={form.transport} onValueChange={(v) => setForm({ ...form, transport: v ?? "" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="http">{t("extensions.mcp.transportHttp")}</SelectItem>
                  <SelectItem value="sse">{t("extensions.mcp.transportSse")}</SelectItem>
                  <SelectItem value="stdio">{t("extensions.mcp.transportStdio")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* HTTP/SSE config */}
            {(form.transport === "http" || form.transport === "sse") && (
              <div className="space-y-3 border rounded-lg p-3">
                <Label className="text-xs font-semibold uppercase text-muted-foreground">
                  {form.transport === "http" ? "HTTP" : "SSE"}
                </Label>
                <div className="space-y-2">
                  <Label htmlFor="mcp-url">{t("extensions.mcp.url")}</Label>
                  <Input
                    id="mcp-url"
                    value={form.url}
                    onChange={(e) => setForm({ ...form, url: e.target.value })}
                    placeholder={t("extensions.mcp.urlPlaceholder")}
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mcp-headers">{t("extensions.mcp.headers")}</Label>
                  <Input
                    id="mcp-headers"
                    value={form.headers}
                    onChange={(e) => setForm({ ...form, headers: e.target.value })}
                    placeholder='{"Authorization": "Bearer xxx"}'
                    className="font-mono text-sm"
                  />
                </div>
              </div>
            )}

            {/* stdio config */}
            {form.transport === "stdio" && (
              <div className="space-y-3 border rounded-lg p-3">
                <Label className="text-xs font-semibold uppercase text-muted-foreground">Stdio</Label>
                <div className="space-y-2">
                  <Label htmlFor="mcp-command">{t("extensions.mcp.command")}</Label>
                  <Input
                    id="mcp-command"
                    value={form.command}
                    onChange={(e) => setForm({ ...form, command: e.target.value })}
                    placeholder={t("extensions.mcp.commandPlaceholder")}
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mcp-args">{t("extensions.mcp.args")}</Label>
                  <Input
                    id="mcp-args"
                    value={form.args}
                    onChange={(e) => setForm({ ...form, args: e.target.value })}
                    placeholder={t("extensions.mcp.argsPlaceholder")}
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mcp-env">{t("extensions.mcp.env")}</Label>
                  <Input
                    id="mcp-env"
                    value={form.env}
                    onChange={(e) => setForm({ ...form, env: e.target.value })}
                    placeholder='{"API_KEY": "xxx"}'
                    className="font-mono text-sm"
                  />
                </div>
                <p className="text-xs text-warning">{t("extensions.mcp.stdioWarning")}</p>
              </div>
            )}

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

            {/* Test connection */}
            {mcpId && (
              <div className="space-y-3 border rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold uppercase text-muted-foreground">
                    {t("extensions.mcp.capabilities")}
                  </Label>
                  <Button type="button" variant="outline" size="sm" onClick={handleTest} disabled={testing}>
                    <Zap className="h-3.5 w-3.5 mr-1" />
                    {testing ? t("extensions.mcp.testing") : t("extensions.mcp.testConnection")}
                  </Button>
                </div>
                {testResult && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Circle className={`h-2 w-2 fill-current ${statusColor[testResult.status] || statusColor.untested}`} />
                      <span className="text-sm font-medium">{testResult.status}</span>
                      {testResult.error && (
                        <span className="text-xs text-destructive">{testResult.error}</span>
                      )}
                    </div>
                    {testResult.capabilities && (
                      <div className="space-y-1 text-xs">
                        <div>{t("extensions.mcp.tools")}: {testResult.capabilities.tools.length}</div>
                        <div>{t("extensions.mcp.resources")}: {testResult.capabilities.resources.length}</div>
                        <div>{t("extensions.mcp.promptsLabel")}: {testResult.capabilities.prompts.length}</div>
                      </div>
                    )}
                  </div>
                )}
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
