"use client"

import { useWorkflowStore } from "@/stores/workflow"
import type { WorkflowNode } from "@/types/workflow"
import { useTranslation } from "@/i18n"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface FeishuConfigProps { node: WorkflowNode }

export function FeishuConfig({ node }: FeishuConfigProps) {
  const { t } = useTranslation()
  const { updateNodeData } = useWorkflowStore()
  const config = (node.data.config as Record<string, unknown>) || {}

  const updateConfig = (key: string, value: unknown) => {
    updateNodeData(node.id, { config: { ...config, [key]: value } })
  }

  return (
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
  )
}