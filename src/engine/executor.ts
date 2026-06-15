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

// ---- Executor Registry ----

const nodeExecutors: Record<string, NodeExecutor> = {
  input: executeInputNode,
  llm: executeLLMNode,
  output: executeOutputNode,
  feishu: executeFeishuNode,
  http: executeHttpNode,
  condition: executeConditionNode,
  merge: executeMergeNode,
  cron_trigger: executeCronTriggerNode,
}

/**
 * 注册自定义执行器（用于扩展节点类型）
 */
export function registerExecutor(type: string, executor: NodeExecutor) {
  nodeExecutors[type] = executor
}

// ---- Retry with exponential backoff ----

interface RetryConfig {
  maxRetries: number           // 最大重试次数（默认 0）
  retryDelay: number           // 初始重试间隔 ms（默认 1000）
  backoffMultiplier: number    // 退避倍数（默认 2）
}

function getRetryConfig(node: WorkflowNode): RetryConfig {
  const config = (node.data.config as Record<string, unknown>) || {}
  return {
    maxRetries: (config.retryCount as number) ?? (config.maxRetries as number) ?? 0,
    retryDelay: (config.retryDelay as number) ?? 1000,
    backoffMultiplier: (config.backoffMultiplier as number) ?? 2,
  }
}

/**
 * 带指数退避的执行单个节点
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
      throw error // All retries exhausted
    }
  }
  throw new Error("Unreachable")
}

// ---- Topological Sort ----

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

// ---- Main Execution ----

export async function executeWorkflow(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  input: Record<string, unknown>,
  workflowId: string,
  executionId: string,
): Promise<ExecutionResult> {
  const sortedNodes = topologicalSort(nodes, edges)

  const context: ExecutionContext = {
    workflowId,
    executionId,
    input,
    nodeResults: new Map(),
    logs: [],
  }

  const startTime = Date.now()
  let lastError: string | undefined
  const skippedNodes = new Set<string>()

  try {
    for (const node of sortedNodes) {
      // Skip nodes in inactive branches
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

        // Execute with retry
        const result = await executeNodeWithRetry(node, executor, context)
        context.nodeResults.set(node.id, result)

        log.status = "completed"
        log.output = result
        log.durationMs = Date.now() - startTime

        // Handle condition node branching
        if (node.data.type === "condition" && result && typeof result === "object") {
          const condResult = (result as Record<string, unknown>).result as boolean
          // Find which branch to skip
          const skipHandle = condResult ? "false" : "true"
          // Find ALL downstream nodes on the skipped branch
          const toSkip = findDownstreamNodes(node.id, skipHandle, nodes, edges)
          for (const nid of toSkip) skippedNodes.add(nid)
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        log.status = "failed"
        log.error = msg
        lastError = msg

        // Store error in results so downstream error-handler nodes can access it
        context.nodeResults.set(node.id, {
          error: msg,
          raw: msg,
          failedNodeId: node.id,
          failedNodeType: node.data.type,
        })

        // Continue to let error-handler nodes process the failure
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
