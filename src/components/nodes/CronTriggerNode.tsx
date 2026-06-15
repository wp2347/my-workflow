"use client"

import { memo } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { Timer } from "lucide-react"

function formatCron(expr: string): string {
  if (!expr) return "未配置"
  if (expr === "0 * * * *") return "每小时"
  const parts = expr.split(" ")
  const hour = parts[1] || "9"
  const minute = parts[0] || "0"
  const time = `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`
  if (expr.includes("* * 1-5")) return `工作日 ${time}`
  const m = expr.match(/^\S+\s+\S+\s+\*\s+\*\s+(\d)$/)
  if (m) {
    const days = ["日", "一", "二", "三", "四", "五", "六"]
    return `每周${days[parseInt(m[1])] || m[1]} ${time}`
  }
  return `每天 ${time}`
}

function CronTriggerNode({ data, selected }: NodeProps) {
  const config = data.config as Record<string, unknown> | undefined
  return (
    <div className={`px-4 py-3 rounded-xl border-2 bg-card shadow-sm min-w-[180px] ${selected ? "border-primary" : "border-teal-200"}`}>
      <div className="flex items-center gap-2 mb-1">
        <div className="rounded-md bg-teal-100 p-1"><Timer className="h-4 w-4 text-teal-600" /></div>
        <span className="text-sm font-semibold text-foreground">定时</span>
      </div>
      <div className="text-xs text-muted-foreground truncate max-w-[180px]">
        {formatCron((config?.cronExpr as string) || "")}
      </div>
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-teal-400 !border-2 !border-background" />
    </div>
  )
}

export const CronTriggerNodeComponent = memo(CronTriggerNode)
