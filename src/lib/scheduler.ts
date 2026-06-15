import { prisma } from "@/lib/prisma"
import { executeWorkflow } from "@/engine/executor"
import type { NodeType, WorkflowNodeData } from "@/types/workflow"
import { CronExpressionParser } from "cron-parser"

// 防止同一分钟重复执行
const runLog = new Map<string, number>()

/**
 * 核心调度器：每分钟检查一次数据库，到点自动执行定时工作流
 *
 * 工作流需满足三个条件：
 * 1. enabled = true（已启用）
 * 2. schedule 字段不为空（已设置时间，格式 HH:MM，如 "08:30"）
 * 3. schedule 匹配当前系统时间
 *
 * 执行时会将 notifyChatId 作为目标，飞书节点自动发送到对应群聊
 */
export async function checkScheduledWorkflows() {
  const now = new Date()
  const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`

  try {
    // 查询所有启用的定时工作流
    const workflows = await prisma.workflow.findMany({
      where: {
        enabled: true,
        schedule: { not: null },
      },
    })

    for (const wf of workflows) {
      const schedule = wf.schedule || ""

      // Check HH:MM format
      if (/^\d{2}:\d{2}$/.test(schedule)) {
        if (schedule !== time) continue
      }
      // Check cron expression format
      else if (schedule.includes(" ")) {
        try {
          const interval = CronExpressionParser.parse(schedule)
          const next = interval.next().toDate()
          const diff = Math.abs(next.getTime() - now.getTime())
          if (diff > 60000) continue // Not due yet
        } catch {
          continue // Invalid cron expression
        }
      }
      else continue

      // 防止同一分钟内重复执行（setInterval 30秒会触发两次）
      const lastRun = runLog.get(wf.id) || 0
      if (Date.now() - lastRun < 60000) continue
      runLog.set(wf.id, Date.now())

      console.log(`[Scheduler] ⏰ ${time} 执行：${wf.name}`)

      try {
        // 获取完整的节点和连线
        const fullWf = await prisma.workflow.findUnique({
          where: { id: wf.id },
          include: { nodes: true, edges: true },
        })
        if (!fullWf) continue

        // 组装执行参数
        const nodes = fullWf.nodes.map((n) => ({
          id: n.id,
          type: n.type as NodeType,
          position: { x: n.positionX, y: n.positionY },
          data: n.data as WorkflowNodeData,
        }))

        const edges = fullWf.edges.map((e) => ({
          id: e.id, source: e.source, target: e.target,
        }))

        // 执行工作流，chatId 传给飞书节点用来发送
        const result = await executeWorkflow(
          nodes, edges,
          { chatId: wf.notifyChatId || "", message: "", fromSchedule: true },
          wf.id, `sched-${Date.now()}`,
        )

        // 记录最后执行时间
        await prisma.workflow.update({
          where: { id: wf.id },
          data: { lastRunAt: new Date() },
        })

        console.log(`[Scheduler] ✅ ${wf.name} 执行${result.status}`)
        for (const log of result.logs) {
          if (log.error) console.log(`[Scheduler]   ❌ ${log.nodeType}: ${log.error}`)
        }
      } catch (err) {
        console.error(`[Scheduler] ❌ ${wf.name} 失败:`, err)
      }
    }
  } catch (err) {
    console.error("[Scheduler] 检查失败:", err)
  }
}
