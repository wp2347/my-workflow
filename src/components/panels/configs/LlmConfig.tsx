"use client"

import { useState, useEffect } from "react"
import { useWorkflowStore } from "@/stores/workflow"
import type { WorkflowNode, ExtensionBindings } from "@/types/workflow"
import { PROVIDERS } from "@/lib/providers"
import { useTranslation } from "@/i18n"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { ExternalLink, Eye, EyeOff, Package } from "lucide-react"
import { ExtensionPicker } from "@/components/extensions/ExtensionPicker"
import { CredentialSelect } from "@/components/panels/CredentialSelect"

interface LlmConfigProps { node: WorkflowNode }

export function LlmConfig({ node }: LlmConfigProps) {
  const { t } = useTranslation()
  const { updateNodeData } = useWorkflowStore()
  const config = (node.data.config as Record<string, unknown>) || {}
  const [showApiKey, setShowApiKey] = useState(false)
  const [documents, setDocuments] = useState<Array<{ id: string; name: string }>>([])

  useEffect(() => {
    fetch("/api/documents").then(r => r.json()).then(setDocuments).catch(() => {})
  }, [])

  const updateConfig = (key: string, value: unknown) => {
    updateNodeData(node.id, { config: { ...config, [key]: value } })
  }

  const selectedProvider = PROVIDERS.find((p) => p.id === (config.provider as string || "openai"))

  const handleProviderChange = (providerId: string | null) => {
    if (!providerId) return
    const provider = PROVIDERS.find((p) => p.id === providerId)
    updateNodeData(node.id, {
      config: { ...config, provider: providerId, model: provider?.models[0]?.id || "", baseUrl: provider?.defaultBaseUrl || "", apiKey: config.apiKey || "" },
    })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>{t("config.provider")}</Label>
        <Select value={(config.provider as string) || "openai"} onValueChange={handleProviderChange}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent className="max-h-72">
            {PROVIDERS.map((prov) => (
              <SelectItem key={prov.id} value={prov.id}><span className="flex items-center gap-2">{prov.name}<Badge variant="outline" className="text-[10px] px-1 py-0">{prov.models.length}</Badge></span></SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">{t("config.selectCredential")}</Label>
          {(config.credentialId as string) && <Badge variant="outline" className="text-[10px]">{t("config.credentialSelected")}</Badge>}
        </div>
        <CredentialSelect
          credentialId={(config.credentialId as string) || ""}
          onSelect={(id) => updateConfig("credentialId", id)}
          onClear={() => updateConfig("credentialId", "")}
        />
      </div>
      {!config.credentialId && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="llm-apikey" className="text-xs text-muted-foreground">{t("config.apiKey")}</Label>
            {selectedProvider && (
              <a href={selectedProvider.docs} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline flex items-center gap-0.5">{t("config.getKey")}<ExternalLink className="h-2.5 w-2.5" /></a>
            )}
          </div>
          <div className="relative">
            <Input id="llm-apikey" type={showApiKey ? "text" : "password"} value={(config.apiKey as string) || ""} onChange={(e) => updateConfig("apiKey", e.target.value)} placeholder={selectedProvider ? `Env: ${selectedProvider.defaultApiKeyEnv}` : t("config.apiKeyPlaceholder")} className="pr-8 text-sm font-mono" />
            <button type="button" onClick={() => setShowApiKey(!showApiKey)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">{showApiKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</button>
          </div>
          <p className="text-[10px] text-muted-foreground">{t("config.apiKeyHint", { env: selectedProvider?.defaultApiKeyEnv || "OPENAI_API_KEY" })}</p>
        </div>
      )}
      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">{t("config.advanced")}</summary>
        <div className="mt-2"><Input value={(config.baseUrl as string) || ""} onChange={(e) => updateConfig("baseUrl", e.target.value)} placeholder={selectedProvider?.defaultBaseUrl} className="text-sm font-mono" /></div>
      </details>
      <div className="space-y-2">
        <Label>{t("config.model")}</Label>
        <Select value={(config.model as string) || selectedProvider?.models[0]?.id || ""} onValueChange={(v) => { if (v === "__custom__") { updateConfig("model", ""); updateConfig("customModel", true) } else { updateConfig("model", v); updateConfig("customModel", false) } }}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent className="max-h-60">
            {selectedProvider?.models.map((m) => (
              <SelectItem key={m.id} value={m.id}><span className="flex items-center justify-between w-full gap-2"><span className="truncate">{m.name}</span><Badge variant="secondary" className="text-[10px] px-1 py-0 flex-shrink-0">{m.contextWindow >= 1000 ? `${(m.contextWindow / 1000).toFixed(0)}K` : m.contextWindow}</Badge></span></SelectItem>
            ))}
            <SelectItem value="__custom__" className="text-muted-foreground italic">{t("config.customModel")}</SelectItem>
          </SelectContent>
        </Select>
        {(config.customModel as boolean) && <Input value={(config.model as string) || ""} onChange={(e) => updateConfig("model", e.target.value)} placeholder={t("config.customModelPlaceholder")} className="text-sm font-mono mt-1" />}
      </div>
      <Separator />
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="llm-system-prompt">{t("config.systemPrompt")}</Label>
          <Select value="" onValueChange={(v) => { if (v) updateConfig("systemPrompt", v) }}>
            <SelectTrigger className="w-24 h-6 text-[10px]">              <SelectValue placeholder={t("config.template")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value={t("config.agentAnalystDesc")}>{t("config.agentAnalyst")}</SelectItem>
              <SelectItem value={t("config.agentReviewerDesc")}>{t("config.agentReviewer")}</SelectItem>
              <SelectItem value={t("config.agentWriterDesc")}>{t("config.agentWriter")}</SelectItem>
              <SelectItem value={t("config.agentSupportDesc")}>{t("config.agentSupport")}</SelectItem>
              <SelectItem value={t("config.agentTranslatorDesc")}>{t("config.agentTranslator")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Textarea id="llm-system-prompt" value={(config.systemPrompt as string) || ""} onChange={(e) => updateConfig("systemPrompt", e.target.value)} placeholder="You are a helpful assistant." rows={5} className="text-sm" />
      </div>
      {documents.length > 0 && (
        <div className="space-y-2">
          <Label>{t("config.knowledge")}</Label>
          <Select value={(config.knowledgeId as string) || ""} onValueChange={(v) => updateConfig("knowledgeId", v === "_none" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder={t("config.knowledgePlaceholder")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">{t("config.knowledgeNone")}</SelectItem>
              {documents.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2"><Label htmlFor="llm-temperature" className="text-xs">{t("config.temperature")}</Label><Input id="llm-temperature" type="number" min={0} max={2} step={0.1} value={config.temperature as number ?? 0.7} onChange={(e) => updateConfig("temperature", parseFloat(e.target.value))} /></div>
        <div className="space-y-2"><Label htmlFor="llm-max-tokens" className="text-xs">{t("config.maxTokens")}</Label><Input id="llm-max-tokens" type="number" min={1} max={128000} step={1} value={config.maxTokens as number ?? 4096} onChange={(e) => updateConfig("maxTokens", parseInt(e.target.value))} /></div>
      </div>
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between">
          <Label htmlFor="llm-max-steps" className="text-xs text-muted-foreground">{t("config.agentMaxSteps")}</Label>
          <Input id="llm-max-steps" type="number" min={1} max={20} step={1} className="w-16 h-7 text-xs"
            value={(config.maxSteps as number) ?? 8}
            onChange={(e) => {
              const n = parseInt(e.target.value)
              if (!isNaN(n)) updateConfig("maxSteps", Math.min(Math.max(n, 1), 20))
            }} />
        </div>
        <p className="text-[10px] text-muted-foreground">{t("config.agentMaxStepsHint")}</p>
      </div>
      <div className="flex items-center justify-between pt-1">
        <Label htmlFor="llm-memory" className="text-xs text-muted-foreground">{t("config.memory")}</Label>
        <Input id="llm-memory" type="number" min={0} max={20} className="w-16 h-7 text-xs"
          value={config.memory as number ?? 0}
          onChange={(e) => updateConfig("memory", parseInt(e.target.value) || 0)} />
      </div>
      <div className="flex items-center justify-between pt-1">
        <Label htmlFor="llm-json-mode" className="text-xs text-muted-foreground">{t("config.jsonMode")}</Label>
        <Switch id="llm-json-mode" checked={(config.jsonMode as boolean) || false} onCheckedChange={(v) => updateConfig("jsonMode", v)} />
      </div>
      <div className="flex items-center justify-between pt-1">
        <Label htmlFor="llm-enable-tools" className="text-xs text-muted-foreground">{t("config.functionCalling")}</Label>
        <Switch id="llm-enable-tools" checked={(config.enableTools as boolean) || false} onCheckedChange={(v) => updateConfig("enableTools", v)} />
      </div>

      {/* 扩展包折叠区 */}
      <details className="pt-2 border-t">
        <summary className="cursor-pointer text-xs font-semibold text-muted-foreground hover:text-foreground py-2 flex items-center gap-1.5">
          <Package className="h-3.5 w-3.5" />
          {t("extensions.picker.title")}
        </summary>
        <div className="pt-2">
          <ExtensionPicker
            value={(config.extensions as ExtensionBindings) || { skills: [], prompts: [], mcp: [] }}
            onChange={(ext) => updateConfig("extensions", ext)}
          />
        </div>
      </details>
    </div>
  )
}
