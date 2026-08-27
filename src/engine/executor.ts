import type {
  WorkflowNode,
  WorkflowEdge,
  ExecutionContext,
  ExecutionResult,
  ExecutionLog,
  NodeExecutor,
} from "@/types/workflow"

import { executeInputNode } from "./nodes/input"
import { executeLLMNode } from "./nodes/llm"
import { executeOutputNode } from "./nodes/output"
import { executeFeishuNode } from "./nodes/feishu"
import { executeHttpNode } from "./nodes/http"
import { executeConditionNode } from "./nodes/condition"
import { executeMergeNode } from "./nodes/merge"
import { executeCronTriggerNode } from "./nodes/cron_trigger"
import { executeMusicNode } from "./nodes/music"

// ============================================================
// 节点执行器注册表
// 每种节点类型对应一个执行函数，由 executeWorkflow 调度
// ============================================================

const nodeExecutors: Record<string, NodeExecutor> = {
  input: executeInputNode,
  llm: executeLLMNode,
  output: executeOutputNode,
  feishu: executeFeishuNode,
  http: executeHttpNode,
  condition: executeConditionNode,
  merge: executeMergeNode,
  cron_trigger: executeCronTriggerNode,
  music: executeMusicNode,
}

/**
 * 注册自定义执行器（插件化扩展新节点类型）
 */
export function registerExecutor(type: string, executor: NodeExecutor) {
  nodeExecutors[type] = executor
}

// ============================================================
// 重试机制：指数退避
// 节点配置 retryCount/retryDelay/backoffMultiplier
// ============================================================

interface RetryConfig {
  maxRetries: number           // 最大重试次数（默认 0）
  retryDelay: number           // 初始重试间隔 ms（默认 1000）
  backoffMultiplier: number    // 退避倍数（默认 2）
}

/** 从节点配置中提取重试参数 */
function getRetryConfig(node: WorkflowNode): RetryConfig {
  const config = (node.data.config as Record<string, unknown>) || {}
  return {
    maxRetries: (config.retryCount as number) ?? (config.maxRetries as number) ?? 0,
    retryDelay: (config.retryDelay as number) ?? 1000,
    backoffMultiplier: (config.backoffMultiplier as number) ?? 2,
  }
}

/**
 * 带指数退避的执行单个节点。
 * 失败后按 delay * multiplier^attempt 递增等待时间重试。
 */
async function executeNodeWithRetry(
  node: WorkflowNode,
  executor: NodeExecutor,
  context: ExecutionContext,
): Promise<unknown> {
  const retry = getRetryConfig(node)

  for (let attempt = 0; attempt <= retry.maxRetries; attempt++) {
    try {
      return await executor(node, context)
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)

      if (attempt < retry.maxRetries) {
        const delay = retry.retryDelay * Math.pow(retry.backoffMultiplier, attempt)
        console.log(`[Retry] ${node.id} attempt ${attempt + 1}/${retry.maxRetries} failed: ${msg}. Retrying in ${delay}ms...`)
        await new Promise((r) => setTimeout(r, delay))
        continue
      }
      throw error // 所有重试已耗尽
    }
  }
  throw new Error("Unreachable")
}

// ============================================================
// 拓扑排序：将 DAG 节点按依赖关系排序为执行序列
// ============================================================

export function topologicalSort(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
  const adjacency = new Map<string, string[]>()
  const inDegree = new Map<string, number>()

  for (const node of nodes) {
    adjacency.set(node.id, [])
    inDegree.set(node.id, 0)
  }

  for (const edge of edges) {
    const neighbors = adjacency.get(edge.source) || []
    neighbors.push(edge.target)
    adjacency.set(edge.source, neighbors)
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1)
  }

  // BFS：入度为 0 的节点先入队
  const queue: string[] = []
  for (const [nodeId, degree] of inDegree) {
    if (degree === 0) queue.push(nodeId)
  }

  const sorted: WorkflowNode[] = []
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))

  while (queue.length > 0) {
    const current = queue.shift()!
    const node = nodeMap.get(current)
    if (node) sorted.push(node)

    for (const neighbor of adjacency.get(current) || []) {
      const newDegree = (inDegree.get(neighbor) || 0) - 1
      inDegree.set(neighbor, newDegree)
      if (newDegree === 0) queue.push(neighbor)
    }
  }

  return sorted
}

// ============================================================
// 主执行流程
// 工作流引擎的核心入口：
//   1. 拓扑排序确定执行顺序
//   2. 按序执行节点（含重试）
//   3. 条件节点分支处理（跳过不匹配的分支）
//   4. 收集日志和结果
// ============================================================

export async function executeWorkflow(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  input: Record<string, unknown>,
  workflowId: string,
  executionId: string,
): Promise<ExecutionResult> {
  // 拓扑排序：确保先执行依赖节点
  const sortedNodes = topologicalSort(nodes, edges)

  // 加载工作流级扩展绑定
  let workflowExtensions: ExecutionContext["workflowExtensions"]
  try {
    const { prisma } = await import("@/lib/prisma")
    const wf = await prisma.workflow.findUnique({
      where: { id: workflowId },
      select: { config: true },
    })
    const config = (wf?.config as Record<string, unknown>) || {}
    workflowExtensions = (config.extensions as ExecutionContext["workflowExtensions"]) || undefined
  } catch (error) {
    console.warn("[executor] Failed to load workflow extensions:", error)
  }

  const context: ExecutionContext = {
    workflowId,
    executionId,
    input,
    nodeResults: new Map(),
    logs: [],
    workflowExtensions,
  }

  const startTime = Date.now()
  let lastError: string | undefined
  const skippedNodes = new Set<string>()

  try {
    for (const node of sortedNodes) {
      // 跳过已因条件分支被排除的节点
      if (skippedNodes.has(node.id)) continue

      const log: ExecutionLog = {
        nodeId: node.id,
        nodeType: node.data.type,
        status: "running",
        timestamp: new Date().toISOString(),
      }
      context.logs.push(log)

      try {
        const executor = nodeExecutors[node.data.type]
        if (!executor) {
          throw new Error(`No executor found for node type: ${node.data.type}`)
        }

        // 执行节点（带重试）
        const result = await executeNodeWithRetry(node, executor, context)
        context.nodeResults.set(node.id, result)

        log.status = "completed"
        log.output = result
        log.durationMs = Date.now() - startTime

        // Agent 步骤明细抄写：工具型节点若在结果里带了 steps 数组，提升到日志顶层
        if (result && typeof result === "object") {
          const steps = (result as Record<string, unknown>).steps
          if (Array.isArray(steps) && steps.length > 0) {
            log.steps = steps as ExecutionLog["steps"]
          }
        }

        // 条件节点分支处理：根据条件结果跳过不匹配的分支
        if (node.data.type === "condition" && result && typeof result === "object") {
          const condResult = (result as Record<string, unknown>).result as boolean
          const skipHandle = condResult ? "false" : "true"
          const toSkip = findDownstreamNodes(node.id, skipHandle, nodes, edges)
          for (const nid of toSkip) skippedNodes.add(nid)
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        log.status = "failed"
        log.error = msg
        lastError = msg

        // 将错误信息存入结果，供下游错误处理节点使用
        context.nodeResults.set(node.id, {
          error: msg,
          raw: msg,
          failedNodeId: node.id,
          failedNodeType: node.data.type,
        })

        // 继续执行，让错误处理节点有机会处理
        continue
      }

      context.logs[context.logs.length - 1] = { ...log, timestamp: new Date().toISOString() }
    }

    const finalOutput = findFinalOutput(sortedNodes, context)

    return {
      executionId,
      workflowId,
      status: context.logs.some((l) => l.status === "failed") ? "failed" : "completed",
      logs: context.logs,
      output: finalOutput,
      durationMs: Date.now() - startTime,
      error: lastError,
    }
  } catch (error) {
    return {
      executionId,
      workflowId,
      status: "failed",
      logs: context.logs,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
    }
  }
}

/** 从执行结果中提取最终输出（优先 output 节点，其次最后一个节点） */
function findFinalOutput(sortedNodes: WorkflowNode[], context: ExecutionContext): unknown {
  for (let i = sortedNodes.length - 1; i >= 0; i--) {
    const node = sortedNodes[i]
    if (node.data.type === "output") {
      return context.nodeResults.get(node.id)
    }
  }
  const lastNode = sortedNodes[sortedNodes.length - 1]
  return lastNode ? context.nodeResults.get(lastNode.id) : null
}

/** 从条件节点出发，找到需要跳过的下游节点（BFS 遍历） */
function findDownstreamNodes(
  startId: string,
  skipHandle: string,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): Set<string> {
  const result = new Set<string>()
  const visited = new Set<string>()
  const queue: string[] = []

  for (const edge of edges) {
    if (edge.source === startId && edge.sourceHandle === skipHandle) {
      queue.push(edge.target)
    }
  }

  while (queue.length > 0) {
    const current = queue.shift()!
    if (visited.has(current)) continue
    visited.add(current)
    result.add(current)

    for (const edge of edges) {
      if (edge.source === current) {
        queue.push(edge.target)
      }
    }
  }

  return result
}
