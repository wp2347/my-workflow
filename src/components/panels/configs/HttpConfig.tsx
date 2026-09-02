"use client"

import { useWorkflowStore } from "@/stores/workflow"
import type { WorkflowNode } from "@/types/workflow"
import { useTranslation } from "@/i18n"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface HttpConfigProps { node: WorkflowNode }

export function HttpConfig({ node }: HttpConfigProps) {
  const { t } = useTranslation()
  const { updateNodeData } = useWorkflowStore()
  const config = (node.data.config as Record<string, unknown>) || {}

  const updateConfig = (key: string, value: unknown) => {
    updateNodeData(node.id, { config: { ...config, [key]: value } })
  }

  return (
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
        </div>
      </details>
    </div>
  )
}