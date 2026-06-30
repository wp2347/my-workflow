import type { ExtensionBindings } from "@/types/workflow"

/**
 * 合并工作流级和节点级扩展绑定。
 * 替换语义:节点级 extensions 对象存在 → 整体覆盖工作流级;不存在 → 回退工作流级。
 */
export function mergeExtensions(
  wfExt: ExtensionBindings | undefined,
  nodeConfig: Record<string, unknown>,
): ExtensionBindings {
  const nodeExt = nodeConfig.extensions as Partial<ExtensionBindings> | undefined

  if (nodeExt) {
    return {
      skills: nodeExt.skills ?? [],
      prompts: nodeExt.prompts ?? [],
      mcp: nodeExt.mcp ?? [],
    }
  }

  return {
    skills: wfExt?.skills ?? [],
    prompts: wfExt?.prompts ?? [],
    mcp: wfExt?.mcp ?? [],
  }
}
