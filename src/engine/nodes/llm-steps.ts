import type { ToolCallStep, ToolCallInfo } from "@/types/workflow"

/** 摘要截断阈值（spec §3.1：超 500 字符截断，避免日志膨胀） */
const SUMMARY_MAX_LEN = 500

/** 将任意值序列化为日志摘要；undefined → ""，超长截断加省略号 */
export function truncateForSummary(value: unknown): string {
  if (value === undefined) return ""
  let text: string
  try {
    text = typeof value === "string" ? value : JSON.stringify(value)
  } catch {
    text = String(value)
  }
  if (!text) return ""
  if (text.length <= SUMMARY_MAX_LEN) return text
  return text.slice(0, SUMMARY_MAX_LEN) + "…"
}

/** 测试/执行侧可传入的最小 SDK step 形状（v5/v6 字段名：input/output） */
export interface SdkStepLike {
  content?: Array<{ type: string; text?: string }>
  toolCalls?: Array<{ toolName?: string; input?: unknown } & Record<string, unknown>>
  toolResults?: Array<{ toolName?: string; output?: unknown } & Record<string, unknown>>
}

/**
 * 把 AI SDK generateText 的多步结果装配为 ToolCallStep[] 与 ToolCallInfo[]。
 * - 耗时来源：timings 按 toolName 维护 FIFO 队列（由 instrumentTools 写入），
 *   同名多次调用按发生顺序消耗；缺失回落 0。
 * - 同一 step 内 toolCalls 与 toolResults 按下标对齐（AI SDK 保证）。
 */
export function assembleToolCallSteps(
  sdkSteps: SdkStepLike[],
  timings: Map<string, number[]>,
): { steps: ToolCallStep[]; toolCalls: ToolCallInfo[] } {
  const steps: ToolCallStep[] = []
  const toolCalls: ToolCallInfo[] = []

  for (const step of sdkSteps) {
    const calls = step.toolCalls || []
    const results = step.toolResults || []
    for (let i = 0; i < calls.length; i++) {
      const name = calls[i]?.toolName
      if (!name) continue
      const queue = timings.get(name)
      const durationMs = queue && queue.length > 0 ? queue.shift()! : 0
      const callStep: ToolCallStep = {
        toolName: name,
        argsSummary: truncateForSummary(calls[i]?.input),
        resultSummary: truncateForSummary(results[i]?.output),
        durationMs,
      }
      steps.push(callStep)
      toolCalls.push({ name, args: calls[i]?.input, summary: callStep.resultSummary })
    }
  }

  return { steps, toolCalls }
}
