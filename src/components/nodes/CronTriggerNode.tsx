"use client"

import { memo } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { Timer } from "lucide-react"
import { nodeCard, nodeIcon, nodeHandle } from "@/components/nodes/nodeStyles"
import { useTranslation } from "@/i18n"

function formatCron(expr: string, t: (k: string, params?: Record<string, string | number>) => string): string {
  if (!expr) return t("cronNode.unconfigured")
  if (expr === "0 * * * *") return t("cronNode.hourly")
  const parts = expr.split(" ")
  const hour = parts[1] || "9"
  const minute = parts[0] || "0"
  const time = `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`
  if (expr.includes("* * 1-5")) return t("cronNode.weekday", { time })
  const m = expr.match(/^\S+\s+\S+\s+\*\s+\*\s+(\d)$/)
  if (m) {
    const dayKey = `cronNode.days.${m[1]}`
    return t("cronNode.weekly", { day: t(dayKey), time })
  }
  return t("cronNode.daily", { time })
}

function CronTriggerNode({ data, selected }: NodeProps) {
  const { t } = useTranslation()
  const config = data.config as Record<string, unknown> | undefined
  return (
    <div className={nodeCard(!!selected)}>
      <div className="flex items-center gap-2 mb-1">
        <div className={nodeIcon("cron_trigger")}>
          <Timer className="h-4 w-4" />
        </div>
        <span className="text-sm font-semibold text-foreground">{t("cronNode.label")}</span>
      </div>
      <div className="text-xs text-muted-foreground truncate max-w-[180px]">
        {formatCron((config?.cronExpr as string) || "", t)}
      </div>
      <Handle type="source" position={Position.Bottom} className={nodeHandle("cron_trigger")} />
    </div>
  )
}

export const CronTriggerNodeComponent = memo(CronTriggerNode)
