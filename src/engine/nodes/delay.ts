import type { NodeExecutor } from "@/types/workflow"

const DEFAULT_DELAY_MS = 1000
const MAX_DELAY_MS = 5 * 60 * 1000 // spec：延时范围限制（最大 5 分钟）

/**
 * 延时节节点：等待指定毫秒后透传上游输出。
 * 用于限速轮询、错峰调用外部 API 等场景。
 */
export const executeDelayNode: NodeExecutor = async (node, context) => {
  const config = (node.data.config as Record<string, unknown>) || {}
  const requested = Math.round((config.durationMs as number) ?? DEFAULT_DELAY_MS)
  // clamp：非法/负值回落默认，上限 5 分钟防呆
  const durationMs = requested > 0 ? Math.min(requested, MAX_DELAY_MS) : DEFAULT_DELAY_MS

  await new Promise((resolve) => setTimeout(resolve, durationMs))

  // 透传上游 raw 输出
  let raw = ""
  for (const [, output] of context.nodeResults) {
    if (typeof output === "object" && output !== null) {
      const r = (output as Record<string, unknown>).raw
      if (typeof r === "string") raw = r
    } else if (typeof output === "string") {
      raw = output
    }
  }

  return { raw, delayedMs: durationMs }
}
