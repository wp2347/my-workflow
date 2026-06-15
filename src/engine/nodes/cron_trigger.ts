import type { WorkflowNode, ExecutionContext, NodeExecutor } from "@/types/workflow"

export const executeCronTriggerNode: NodeExecutor = async (node, context) => {
  const config = (node.data.config as Record<string, unknown>) || {}
  const name = (config.name as string) || "Cron Job"
  const cronExpr = (config.cronExpr as string) || ""
  const timezone = (config.timezone as string) || "Asia/Shanghai"

  // This node acts as a trigger - output the input that was passed by the cron job
  return {
    triggerType: "cron",
    name,
    cronExpr,
    timezone,
    message: (context.input?.message as string) || "",
    raw: (context.input?.message as string) || "",
  }
}
