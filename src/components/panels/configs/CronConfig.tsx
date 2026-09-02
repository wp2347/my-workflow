"use client"

import { useState } from "react"
import { useWorkflowStore } from "@/stores/workflow"
import type { WorkflowNode } from "@/types/workflow"
import { useTranslation } from "@/i18n"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface CronConfigProps { node: WorkflowNode }

export function CronConfig({ node }: CronConfigProps) {
  const { t } = useTranslation()
  const { updateNodeData } = useWorkflowStore()
  const config = (node.data.config as Record<string, unknown>) || {}
  const [frequency, setFrequency] = useState((config.frequency as string) || "daily")
  const [hour, setHour] = useState(((config.cronExpr as string) || "0 9 * * *").split(" ")[1] || "9")
  const [minute, setMinute] = useState(((config.cronExpr as string) || "0 9 * * *").split(" ")[0] || "0")

  const frequencyLabel: Record<string, string> = {
    hourly: t("config.cronHourly"),
    daily: t("config.cronDaily"),
    weekday: t("config.cronWeekday"),
    "weekly-0": t("config.cronSunday"), "weekly-1": t("config.cronMonday"),
    "weekly-2": t("config.cronTuesday"), "weekly-3": t("config.cronWednesday"),
    "weekly-4": t("config.cronThursday"), "weekly-5": t("config.cronFriday"),
    "weekly-6": t("config.cronSaturday"),
  }

  const updateConfig = (key: string, value: unknown) => {
    updateNodeData(node.id, { config: { ...config, [key]: value } })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="cron-name">{t("config.cronName")}</Label>
        <Input id="cron-name" value={(config.name as string) || ""} onChange={(e) => updateConfig("name", e.target.value)} placeholder={t("config.cronNamePlaceholder")} />
      </div>
      <div className="space-y-2">
        <Label>{t("config.cronFrequency")}</Label>
        <Select
          value={frequency}
          onValueChange={(v) => {
            if (!v) return
            setFrequency(v)
            if (v === "hourly") { updateConfig("frequency", v); updateConfig("cronExpr", "0 * * * *") }
            else if (v === "weekday") { updateConfig("frequency", v); updateConfig("cronExpr", `${minute} ${hour} * * 1-5`) }
            else if (v === "daily") { updateConfig("frequency", v); updateConfig("cronExpr", `${minute} ${hour} * * *`) }
            else if (v.startsWith("weekly-")) { updateConfig("frequency", v); updateConfig("cronExpr", `${minute} ${hour} * * ${v.split("-")[1]}`) }
          }}
        >
          <SelectTrigger className="w-full">
            <span className="text-sm">{frequencyLabel[frequency] || frequency}</span>
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
      {frequency !== "hourly" && (
        <div className="space-y-2">
          <Label>{t("config.cronTime")}</Label>
          <div className="grid grid-cols-2 gap-3">
            <Select value={hour} onValueChange={(v) => {
              if (!v) return
              setHour(v)
              updateConfig("cronExpr", `${minute} ${v} * * *`)
            }}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-48">
                {Array.from({length: 24}, (_, i) => (
                  <SelectItem key={i} value={String(i)}>{String(i).padStart(2, "0")}:00</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={minute} onValueChange={(v) => {
              if (!v) return
              setMinute(v)
              updateConfig("cronExpr", `${v} ${hour} * * *`)
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
      )}
      <div className="p-3 rounded-lg bg-node-cron-bg text-xs text-muted-foreground">
        {t("config.cronHint")}
      </div>
    </div>
  )
}