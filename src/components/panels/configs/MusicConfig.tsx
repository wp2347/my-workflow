"use client"

import { useState } from "react"
import { useWorkflowStore } from "@/stores/workflow"
import type { WorkflowNode } from "@/types/workflow"
import { useTranslation } from "@/i18n"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { CredentialSelect } from "@/components/panels/CredentialSelect"

interface MusicConfigProps { node: WorkflowNode }

export function MusicConfig({ node }: MusicConfigProps) {
  const { t } = useTranslation()
  const { updateNodeData } = useWorkflowStore()
  const config = (node.data.config as Record<string, unknown>) || {}
  const [headersText, setHeadersText] = useState(() => JSON.stringify(config.headers || {}, null, 2))
  const [headersError, setHeadersError] = useState<string | null>(null)
  const [prevHeadersConfig, setPrevHeadersConfig] = useState(config.headers)

  if (config.headers !== prevHeadersConfig) {
    setPrevHeadersConfig(config.headers)
    setHeadersText(JSON.stringify((config.headers as Record<string, string>) || {}, null, 2))
    setHeadersError(null)
  }

  const updateConfig = (key: string, value: unknown) => {
    updateNodeData(node.id, { config: { ...config, [key]: value } })
  }

  return (
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
  )
}