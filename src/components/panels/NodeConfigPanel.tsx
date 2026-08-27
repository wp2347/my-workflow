"use client"

import { useState, useEffect } from "react"
import { useWorkflowStore } from "@/stores/workflow"
import { useRunResultsStore } from "@/stores/runResults"
import type { WorkflowNode } from "@/types/workflow"
import { useTranslation } from "@/i18n"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Trash2, Download, FolderOpen, X } from "lucide-react"
import { CredentialSelect } from "@/components/panels/CredentialSelect"
import { LocalDirPicker } from "@/components/panels/LocalDirPicker"
import { MusicPlayer } from "@/components/music/MusicPlayer"
import { LlmConfig } from "@/components/panels/configs/LlmConfig"
import { KnowledgeSearchConfig } from "@/components/panels/configs/KnowledgeSearchConfig"

interface NodeConfigPanelProps { node: WorkflowNode }

export function NodeConfigPanel({ node }: NodeConfigPanelProps) {
  const { t } = useTranslation()
  const { updateNodeData, removeNode, setSelectedNodeId, workflowId } = useWorkflowStore()
  const runResult = useRunResultsStore((s) => (workflowId && s.results[workflowId]?.[node.id]) || null)
  const hydrate = useRunResultsStore((s) => s.hydrate)
  const clearNodeResult = useRunResultsStore((s) => s.clearNodeResult)
  const config = (node.data.config as Record<string, unknown>) || {}
  const [dirPickerOpen, setDirPickerOpen] = useState(false)
  const [headersText, setHeadersText] = useState(() => JSON.stringify(config.headers || {}, null, 2))
  const [headersError, setHeadersError] = useState<string | null>(null)
  const [prevHeadersConfig, setPrevHeadersConfig] = useState(config.headers)

  if (config.headers !== prevHeadersConfig) {
    setPrevHeadersConfig(config.headers)
    setHeadersText(JSON.stringify((config.headers as Record<string, string>) || {}, null, 2))
    setHeadersError(null)
  }

  // Cron local state
  const [cronFrequency, setCronFrequency] = useState(() => (config.frequency as string) || "daily")
  const [cronHour, setCronHour] = useState(() => ((config.cronExpr as string) || "0 9 * * *").split(" ")[1] || "9")
  const [cronMinute, setCronMinute] = useState(() => ((config.cronExpr as string) || "0 9 * * *").split(" ")[0] || "0")

  const cronFrequencyLabel: Record<string, string> = {
    hourly: t("config.cronHourly"),
    daily: t("config.cronDaily"),
    weekday: t("config.cronWeekday"),
    "weekly-0": t("config.cronSunday"), "weekly-1": t("config.cronMonday"),
    "weekly-2": t("config.cronTuesday"), "weekly-3": t("config.cronWednesday"),
    "weekly-4": t("config.cronThursday"), "weekly-5": t("config.cronFriday"),
    "weekly-6": t("config.cronSaturday"),
  }

  useEffect(() => {
    if (workflowId) hydrate(workflowId)
  }, [workflowId, hydrate])

  // Reset cron state when node changes
  useEffect(() => {
    if (!node.id) return
    setCronFrequency((config.frequency as string) || "daily")
    const parts = ((config.cronExpr as string) || "0 9 * * *").split(" ")
    setCronHour(parts[1] || "9")
    setCronMinute(parts[0] || "0")
  }, [node.id])

  const updateConfig = (key: string, value: unknown) => {
    updateNodeData(node.id, { config: { ...config, [key]: value } })
  }

  const handleDelete = () => { removeNode(node.id); setSelectedNodeId(null) }

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

  const getCronTime = (cfg: Record<string, unknown>) => {
    const expr = (cfg.cronExpr as string) || "0 9 * * *"
    const parts = expr.split(" ")
    return { minute: parts[0] || "0", hour: parts[1] || "9" }
  }

  return (
    <div className="p-4 space-y-5">
      {/* ===== INPUT NODE ===== */}
      {node.data.type === "input" && (
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
      )}

      {/* ===== LLM NODE ===== */}
      {node.data.type === "llm" && <LlmConfig node={node} />}

      {/* ===== KNOWLEDGE SEARCH NODE ===== */}
      {node.data.type === "knowledge_search" && <KnowledgeSearchConfig node={node} />}

      {/* ===== OUTPUT NODE ===== */}
      {node.data.type === "output" && (
        <div className="space-y-4">
          {runResult && (
            <>
              <div className="space-y-2">
                <Label>{t("config.outputResult")}</Label>
                <div className="rounded-xl border border-node-music-bg bg-node-music-bg/40 p-3">
                  <MusicPlayer audioUrl={runResult.audioUrl} fileName={runResult.fileName} />
                </div>
                <div className="flex items-center gap-2">
                  <a href={runResult.audioUrl} download={runResult.fileName}>
                    <Button variant="outline" size="sm"><Download className="h-3.5 w-3.5 mr-1" />{t("audioResult.download")}</Button>
                  </a>
                  <Button variant="ghost" size="sm" onClick={() => clearNodeResult(workflowId!, node.id)}>
                    {t("audioResult.clear")}
                  </Button>
                </div>
                {Object.keys(runResult.metadata || {}).length > 0 && (
                  <div className="mt-2 rounded-lg border border-border/60 bg-background/60 p-2">
                    <div className="mb-1 text-[11px] font-semibold text-foreground">{t("audioResult.metadata")}</div>
                    <dl className="text-[11px] space-y-0.5">
                      {Object.entries(runResult.metadata).map(([k, v]) => {
                        const label = t(`audioResult.fields.${k}`)
                        return (
                          <div key={k} className="flex gap-2">
                            <dt className="text-muted-foreground min-w-[60px] truncate">{label === `audioResult.fields.${k}` ? k : label}</dt>
                            <dd className="text-foreground break-all">{String(v)}</dd>
                          </div>
                        )
                      })}
                    </dl>
                  </div>
                )}
              </div>
              <Separator />
            </>
          )}
          <div className="space-y-2">
            <Label>{t("config.format")}</Label>
            <Select value={(config.format as string) || "text"} onValueChange={(v) => updateConfig("format", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="json">JSON</SelectItem>
                <SelectItem value="markdown">Markdown</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="output-template">{t("config.template")}</Label>
            <Textarea id="output-template" value={(config.template as string) || ""} onChange={(e) => updateConfig("template", e.target.value)} placeholder={t("config.templatePlaceholder")} rows={4} />
          </div>
          <Separator />
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">{t("config.exportSettings")}</summary>
            <div className="mt-3 space-y-3">
              <div className="space-y-2">
                <Label>{t("config.exportMode")}</Label>
                <Select value={(config.exportMode as string) || "download"} onValueChange={(v) => updateConfig("exportMode", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="download">{t("config.exportDownload")}</SelectItem>
                    <SelectItem value="local">{t("config.exportLocal")}</SelectItem>
                    <SelectItem value="remote">{t("config.exportRemote")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {((config.exportMode as string) || "download") === "local" && (
                <div className="space-y-2">
                  <Label htmlFor="export-path">{t("config.exportPath")}</Label>
                  <Input id="export-path" value={(config.exportPath as string) || ""} onChange={(e) => updateConfig("exportPath", e.target.value)} placeholder="storage/exports/" className="text-sm font-mono" />
                  <p className="text-[10px] text-muted-foreground">{t("config.exportPathHint")}</p>
                </div>
              )}
              {((config.exportMode as string) || "download") === "remote" && (
                <div className="space-y-2">
                  <Label htmlFor="remote-url">{t("config.remoteUrl")}</Label>
                  <Input id="remote-url" value={(config.remoteUrl as string) || ""} onChange={(e) => updateConfig("remoteUrl", e.target.value)} placeholder="https://upload.example.com" className="text-sm font-mono" />
                </div>
              )}
            </div>
          </details>
        </div>
      )}

      {/* ===== MUSIC NODE ===== */}
      {node.data.type === "music" && (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-3">
            <div className="space-y-2 col-span-1">
              <Label>{t("config.musicMethod")}</Label>
              <Select value={(config.method as string) || "POST"} onValueChange={(v) => updateConfig("method", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="POST">POST</SelectItem>
                  <SelectItem value="GET">GET</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 col-span-3">
              <Label htmlFor="music-api-url">{t("config.musicApiUrl")}</Label>
              <Input id="music-api-url" value={(config.apiUrl as string) || ""} onChange={(e) => updateConfig("apiUrl", e.target.value)} placeholder="https://api.example.com/generate" className="text-sm font-mono" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="music-headers">{t("config.musicHeaders")}</Label>
            <Textarea id="music-headers" value={headersText} rows={3} className="text-sm font-mono"
              onChange={(e) => {
                setHeadersText(e.target.value)
                try {
                  const parsed = JSON.parse(e.target.value || "{}")
                  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                    updateConfig("headers", parsed)
                    setHeadersError(null)
                  } else {
                    setHeadersError(t("config.musicHeadersError"))
                  }
                } catch {
                  setHeadersError(t("config.musicHeadersError"))
                }
              }} placeholder='{\n  "Content-Type": "application/json"\n}' />
            {headersError && <p className="text-[10px] text-destructive">{headersError}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="music-body">{t("config.musicBody")}</Label>
            <Textarea id="music-body" value={(config.bodyTemplate as string) || ""} onChange={(e) => updateConfig("bodyTemplate", e.target.value)} placeholder='{"prompt":"{{ $input.prompt }}"}' rows={4} className="text-sm font-mono" />
            <p className="text-[10px] text-muted-foreground">{t("config.musicBodyHint")}</p>
          </div>
          <div className="space-y-2">
            <Label>{t("config.musicAuth")}</Label>
            <Select value={(config.auth as string) || "none"} onValueChange={(v) => updateConfig("auth", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("config.authNone")}</SelectItem>
                <SelectItem value="bearer">{t("config.authBearer")}</SelectItem>
                <SelectItem value="api_key">{t("config.authApiKey")}</SelectItem>
              </SelectContent>
            </Select>
            {((config.auth as string) || "none") !== "none" && (
              <>
                <CredentialSelect
                  credentialId={(config.credentialId as string) || ""}
                  onSelect={(id) => updateConfig("credentialId", id)}
                  onClear={() => updateConfig("credentialId", "")}
                />
                {!config.credentialId && (
                  <Input type="password" value={(config.authToken as string) || ""} onChange={(e) => updateConfig("authToken", e.target.value)} placeholder={t("config.musicAuth")} className="text-sm font-mono" />
                )}
              </>
            )}
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="music-polling">{t("config.musicPolling")}</Label>
              <p className="text-[10px] text-muted-foreground">{t("config.musicPollingHint")}</p>
            </div>
            <Switch id="music-polling" checked={(config.pollingEnabled as boolean) || false} onCheckedChange={(v) => updateConfig("pollingEnabled", v)} />
          </div>
          {(config.pollingEnabled as boolean) && (
            <div className="space-y-3 p-3 rounded-lg bg-muted/50">
              <div className="space-y-2">
                <Label htmlFor="music-task-id" className="text-xs">{t("config.musicTaskIdField")}</Label>
                <Input id="music-task-id" value={(config.taskIdField as string) || ""} onChange={(e) => updateConfig("taskIdField", e.target.value)} placeholder="data.task_id" className="text-sm font-mono" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="music-poll-url" className="text-xs">{t("config.musicPollUrl")}</Label>
                <Input id="music-poll-url" value={(config.pollUrlTemplate as string) || ""} onChange={(e) => updateConfig("pollUrlTemplate", e.target.value)} placeholder="https://api.xxx.com/tasks/{{taskId}}" className="text-sm font-mono" />
                <p className="text-[10px] text-muted-foreground">{t("config.musicPollUrlHint")}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="music-poll-interval" className="text-xs">{t("config.musicPollInterval")}</Label>
                  <Input id="music-poll-interval" type="number" min={0} step={100} value={config.pollIntervalMs as number ?? 3000} onChange={(e) => updateConfig("pollIntervalMs", parseInt(e.target.value) || 0)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="music-poll-max" className="text-xs">{t("config.musicPollMaxAttempts")}</Label>
                  <Input id="music-poll-max" type="number" min={1} value={config.pollMaxAttempts as number ?? 60} onChange={(e) => updateConfig("pollMaxAttempts", parseInt(e.target.value) || 1)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="music-poll-status" className="text-xs">{t("config.musicPollStatusField")}</Label>
                  <Input id="music-poll-status" value={(config.pollStatusField as string) || ""} onChange={(e) => updateConfig("pollStatusField", e.target.value)} placeholder="data.status" className="text-sm font-mono" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="music-poll-success" className="text-xs">{t("config.musicPollSuccessValue")}</Label>
                  <Input id="music-poll-success" value={(config.pollSuccessValue as string) || ""} onChange={(e) => updateConfig("pollSuccessValue", e.target.value)} placeholder="success" className="text-sm font-mono" />
                </div>
              </div>
            </div>
          )}
          <Separator />
          <div className="space-y-3">
            <Label className="text-xs font-semibold">{t("config.musicResultExtract")}</Label>
            <div className="space-y-2">
              <Label htmlFor="music-audio-url-field" className="text-xs">{t("config.musicAudioUrlField")}</Label>
              <Input id="music-audio-url-field" value={(config.audioUrlField as string) || ""} onChange={(e) => updateConfig("audioUrlField", e.target.value)} placeholder="data.audio_url" className="text-sm font-mono" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="music-metadata-field" className="text-xs">{t("config.musicMetadataField")}</Label>
              <Input id="music-metadata-field" value={(config.metadataField as string) || ""} onChange={(e) => updateConfig("metadataField", e.target.value)} placeholder="data.metadata" className="text-sm font-mono" />
            </div>
          </div>
        </div>
      )}

      {/* ===== HTTP NODE ===== */}
      {node.data.type === "http" && (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-3">
            <div className="space-y-2 col-span-1">
              <Label>{t("config.httpMethod")}</Label>
              <Select value={(config.method as string) || "GET"} onValueChange={(v) => updateConfig("method", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="GET">GET</SelectItem>
                  <SelectItem value="POST">POST</SelectItem>
                  <SelectItem value="PUT">PUT</SelectItem>
                  <SelectItem value="DELETE">DELETE</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 col-span-3">
              <Label htmlFor="http-url">{t("config.httpUrl")}</Label>
              <Input id="http-url" value={(config.url as string) || ""} onChange={(e) => updateConfig("url", e.target.value)} placeholder="https://api.example.com?city={{city}}" className="text-sm font-mono" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="http-body">{t("config.httpBody")}</Label>
            <Textarea id="http-body" value={(config.body as string) || ""} onChange={(e) => updateConfig("body", e.target.value)}
              placeholder='{"key": "{{value}}"}' rows={3} className="text-sm font-mono" />
            <p className="text-[10px] text-muted-foreground">{t("config.httpBodyHint")}</p>
          </div>
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">{t("config.httpAuth")}</summary>
            <div className="mt-2 space-y-2">
              <Select value={(config.auth as string) || "none"} onValueChange={(v) => v && updateConfig("auth", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("config.authNone")}</SelectItem>
                  <SelectItem value="bearer">{t("config.authBearer")}</SelectItem>
                  <SelectItem value="basic">{t("config.authBasic")}</SelectItem>
                  <SelectItem value="api_key">{t("config.authApiKey")}</SelectItem>
                </SelectContent>
              </Select>
              {((config.auth as string) || "none") === "bearer" && (
                <Input value={(config.authToken as string) || ""} onChange={(e) => updateConfig("authToken", e.target.value)} placeholder="Bearer token..." className="text-sm font-mono" />
              )}
              {((config.auth as string) || "none") === "basic" && (
                <>
                  <Input value={(config.authUsername as string) || ""} onChange={(e) => updateConfig("authUsername", e.target.value)} placeholder={t("config.authUsername")} className="text-sm" />
                  <Input type="password" value={(config.authPassword as string) || ""} onChange={(e) => updateConfig("authPassword", e.target.value)} placeholder={t("config.authPassword")} className="text-sm" />
                </>
              )}
              {((config.auth as string) || "none") === "api_key" && (
                <Input value={(config.authToken as string) || ""} onChange={(e) => updateConfig("authToken", e.target.value)} placeholder="API Key..." className="text-sm font-mono" />
              )}
              {((config.auth as string) || "none") === "basic" && (
                <>
                  <Input value={(config.authUsername as string) || ""} onChange={(e) => updateConfig("authUsername", e.target.value)}
                    placeholder={t("config.authUsername")} className="text-sm" />
                  <Input type="password" value={(config.authPassword as string) || ""} onChange={(e) => updateConfig("authPassword", e.target.value)}
                    placeholder={t("config.authPassword")} className="text-sm" />
                </>
              )}
              {((config.auth as string) || "none") === "api_key" && (
                <Input value={(config.authToken as string) || ""} onChange={(e) => updateConfig("authToken", e.target.value)}
                  placeholder="API Key..." className="text-sm font-mono" />
              )}
            </div>
          </details>
        </div>
      )}

      {/* ===== CONDITION NODE ===== */}
      {node.data.type === "condition" && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("config.conditionLeft")}</Label>
            <Input value={(config.left as string) || ""} onChange={(e) => updateConfig("left", e.target.value)}
              placeholder="{{ $node.wc1.text }}" className="text-sm font-mono" />
          </div>
          <div className="space-y-2">
            <Label>{t("config.conditionOperator")}</Label>
            <Select value={(config.operator as string) || "=="} onValueChange={(v) => updateConfig("operator", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="==">{t("config.opEquals")}</SelectItem>
                <SelectItem value="!=">{t("config.opNotEquals")}</SelectItem>
                <SelectItem value=">">{t("config.opGreater")}</SelectItem>
                <SelectItem value="<">{t("config.opLess")}</SelectItem>
                <SelectItem value=">=">{t("config.opGreaterEq")}</SelectItem>
                <SelectItem value="<=">{t("config.opLessEq")}</SelectItem>
                <SelectItem value="contains">{t("config.opContains")}</SelectItem>
                <SelectItem value="not_contains">{t("config.opNotContains")}</SelectItem>
                <SelectItem value="starts_with">{t("config.opStartsWith")}</SelectItem>
                <SelectItem value="ends_with">{t("config.opEndsWith")}</SelectItem>
                <SelectItem value="regex">{t("config.opRegex")}</SelectItem>
                <SelectItem value="is_empty">{t("config.opIsEmpty")}</SelectItem>
                <SelectItem value="is_not_empty">{t("config.opNotEmpty")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("config.conditionRight")}</Label>
            <Input value={(config.right as string) || ""} onChange={(e) => updateConfig("right", e.target.value)}
              placeholder="Beijing" className="text-sm font-mono" />
          </div>
          <div className="p-3 rounded-lg bg-warning/10 dark:bg-warning/20 text-xs space-y-1">
            <p className="font-semibold">{t("config.conditionHintTrue")}</p>
            <p className="font-semibold">{t("config.conditionHintFalse")}</p>
            <p className="text-muted-foreground mt-1">{t("config.conditionHintDesc")}</p>
          </div>
        </div>
      )}

      {/* ===== MERGE NODE ===== */}
      {node.data.type === "merge" && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("config.mergeStrategy")}</Label>
            <Select value={(config.strategy as string) || "concat"} onValueChange={(v) => updateConfig("strategy", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="concat">{t("config.mergeConcat")}</SelectItem>
                <SelectItem value="json_array">{t("config.mergeJsonArray")}</SelectItem>
                <SelectItem value="first">{t("config.mergeFirst")}</SelectItem>
                <SelectItem value="last">{t("config.mergeLast")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="p-3 rounded-lg bg-node-merge-bg text-xs">
            {t("config.mergeHint")}
          </div>
        </div>
      )}

      {/* ===== CRON TRIGGER NODE ===== */}
      {node.data.type === "cron_trigger" && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cron-name">{t("config.cronName")}</Label>
            <Input id="cron-name" value={(config.name as string) || ""} onChange={(e) => updateConfig("name", e.target.value)} placeholder={t("config.cronNamePlaceholder")} />
          </div>
          <div className="space-y-2">
            <Label>{t("config.cronFrequency")}</Label>
            <Select
              value={cronFrequency}
              onValueChange={(v) => {
                if (!v) return
                setCronFrequency(v)
                if (v === "hourly") { updateConfig("frequency", v); updateConfig("cronExpr", "0 * * * *") }
                else if (v === "weekday") { updateConfig("frequency", v); updateConfig("cronExpr", `${cronMinute} ${cronHour} * * 1-5`) }
                else if (v === "daily") { updateConfig("frequency", v); updateConfig("cronExpr", `${cronMinute} ${cronHour} * * *`) }
                else if (v.startsWith("weekly-")) { updateConfig("frequency", v); updateConfig("cronExpr", `${cronMinute} ${cronHour} * * ${v.split("-")[1]}`) }
              }}
            >
              <SelectTrigger className="w-full">
                <span className="text-sm">{cronFrequencyLabel[cronFrequency] || cronFrequency}</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hourly">{t("config.cronHourly")}</SelectItem>
                <SelectItem value="daily">{t("config.cronDaily")}</SelectItem>
                <SelectItem value="weekday">{t("config.cronWeekday")}</SelectItem>
                <SelectItem value="weekly-1">{t("config.cronMonday")}</SelectItem>
                <SelectItem value="weekly-2">{t("config.cronTuesday")}</SelectItem>
                <SelectItem value="weekly-3">{t("config.cronWednesday")}</SelectItem>
                <SelectItem value="weekly-4">{t("config.cronThursday")}</SelectItem>
                <SelectItem value="weekly-5">{t("config.cronFriday")}</SelectItem>
                <SelectItem value="weekly-6">{t("config.cronSaturday")}</SelectItem>
                <SelectItem value="weekly-0">{t("config.cronSunday")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(() => {
            if (cronFrequency === "hourly") return null
            return (
              <div className="space-y-2">
                <Label>{t("config.cronTime")}</Label>
                <div className="grid grid-cols-2 gap-3">
                  <Select value={cronHour} onValueChange={(v) => {
                    if (!v) return
                    setCronHour(v)
                    updateConfig("cronExpr", `${cronMinute} ${v} * * *`)
                  }}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent className="max-h-48">
                      {Array.from({length: 24}, (_, i) => (
                        <SelectItem key={i} value={String(i)}>{String(i).padStart(2, "0")}:00</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={cronMinute} onValueChange={(v) => {
                    if (!v) return
                    setCronMinute(v)
                    updateConfig("cronExpr", `${v} ${cronHour} * * *`)
                  }}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent className="max-h-48">
                      {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map(m => (
                        <SelectItem key={m} value={String(m)}>{String(m).padStart(2, "0")}{t("config.cronMinute")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )
          })()}
          <div className="p-3 rounded-lg bg-node-cron-bg text-xs text-muted-foreground">
            {t("config.cronHint")}
          </div>
        </div>
      )}

      {/* ===== FEISHU NODE ===== */}
      {node.data.type === "feishu" && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("config.feishuMode")}</Label>
            <Select value={(config.mode as string) || "send"} onValueChange={(v) => updateConfig("mode", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="send">{t("config.feishuSend")}</SelectItem>
                <SelectItem value="receive">{t("config.feishuReceive")}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">{t("config.feishuModeHint")}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="feishu-app-id">{t("config.feishuAppId")}</Label>
            <Input id="feishu-app-id" value={(config.appId as string) || ""} onChange={(e) => updateConfig("appId", e.target.value)} placeholder={t("config.feishuAppIdPlaceholder")} className="text-sm font-mono" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="feishu-app-secret">{t("config.feishuAppSecret")}</Label>
            <Input id="feishu-app-secret" type="password" value={(config.appSecret as string) || ""} onChange={(e) => updateConfig("appSecret", e.target.value)} placeholder={t("config.feishuAppSecretPlaceholder")} className="text-sm font-mono" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="feishu-verification-token">{t("config.feishuVerificationToken")}</Label>
            <Input id="feishu-verification-token" type="password" value={(config.verificationToken as string) || ""} onChange={(e) => updateConfig("verificationToken", e.target.value)} placeholder="xxxxxxxx" className="text-sm font-mono" />
            <p className="text-[10px] text-muted-foreground">{t("config.feishuCredHint")}</p>
          </div>
          <Separator />

          {((config.mode as string) || "send") === "send" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="feishu-webhook">{t("config.feishuWebhook")}</Label>
                <Input id="feishu-webhook" value={(config.webhookUrl as string) || ""} onChange={(e) => updateConfig("webhookUrl", e.target.value)} placeholder={t("config.feishuWebhookPlaceholder")} className="text-sm font-mono" />
                <p className="text-[10px] text-muted-foreground">{t("config.feishuWebhookOrApp")}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="feishu-message">{t("config.feishuMessage")}</Label>
                <Textarea id="feishu-message" value={(config.message as string) || ""} onChange={(e) => updateConfig("message", e.target.value)} placeholder={t("config.feishuMessagePlaceholder")} rows={4} className="text-sm" />
                <p className="text-[10px] text-muted-foreground">{t("config.feishuMessageHint")}</p>
              </div>
              <div className="space-y-2">
                <Label>{t("config.feishuMsgType")}</Label>
                <Select value={(config.msgType as string) || "text"} onValueChange={(v) => updateConfig("msgType", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">{t("config.feishuText")}</SelectItem>
                    <SelectItem value="markdown">{t("config.feishuMarkdown")}</SelectItem>
                    <SelectItem value="interactive">{t("config.feishuInteractive")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {((config.mode as string) || "send") === "receive" && (
            <div className="space-y-2">
              <Label htmlFor="feishu-message">{t("config.feishuFallback")}</Label>
              <Textarea id="feishu-message" value={(config.message as string) || ""} onChange={(e) => updateConfig("message", e.target.value)} placeholder={t("config.feishuFallbackPlaceholder")} rows={3} className="text-sm" />
              <p className="text-[10px] text-muted-foreground">{t("config.feishuReceiveHint")}</p>
              <div className="mt-2 p-3 rounded-lg bg-muted text-xs font-mono break-all">
                <p className="font-semibold mb-1">{t("config.feishuCallbackUrl")}:</p>
                <p>{process.env.NEXT_PUBLIC_APP_URL || "https://your-app.com"}/api/feishu/callback</p>
          </div>
        </div>
      )}
        </div>
      )}

      <Separator />

      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
          {t("config.retrySettings")}
        </summary>
        <div className="mt-3 space-y-3 p-2 rounded-lg bg-muted/50">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[11px]">{t("config.maxRetries")}</Label>
              <Input type="number" min={0} max={10} step={1}
                value={config.maxRetries as number ?? 0}
                onChange={(e) => updateConfig("maxRetries", parseInt(e.target.value) || 0)} />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">{t("config.retryDelay")}</Label>
              <Input type="number" min={100} max={60000} step={100}
                value={config.retryDelay as number ?? 1000}
                onChange={(e) => updateConfig("retryDelay", parseInt(e.target.value) || 1000)} />
            </div>
          </div>
        </div>
      </details>

      <Separator />
      <Button variant="destructive" size="sm" className="w-full" onClick={handleDelete}>
        <Trash2 className="h-4 w-4 mr-2" />{t("config.deleteNode")}
      </Button>
    </div>
  )
}
