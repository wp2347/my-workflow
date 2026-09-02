import { z } from "zod"

export const PACK_ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,63}$/

const mcpInManifestSchema = z.object({
  name: z.string().min(1).max(64),
  transport: z.enum(["stdio", "http", "sse"]),
  url: z.string().optional(),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string(), z.string()).optional(),
  headers: z.record(z.string(), z.string()).optional(),
  tools: z.union([z.literal("all"), z.array(z.string())]).optional(),
  resources: z.array(z.string()).optional(),
})

const skillInManifestSchema = z.object({
  name: z.string().min(1).max(64),
  description: z.string().min(1),
  category: z.string().optional(),
  content: z.string().min(1),
  tags: z.array(z.string()).optional(),
})

const promptInManifestSchema = skillInManifestSchema.extend({
  role: z.enum(["system", "user"]).optional(),
  variables: z.array(z.string()).optional(),
})

export const packManifestSchema = z.object({
  id: z.string().regex(PACK_ID_PATTERN, "id must match ^[a-z0-9][a-z0-9-]{1,63}$"),
  name: z.string().min(1).max(64),
  description: z.string().min(1).max(1024),
  category: z.string().optional(),
  icon: z.string().optional(),
  version: z.string().min(1),
  mcps: z.array(mcpInManifestSchema).min(1, "at least one mcp required"),
  skills: z.array(skillInManifestSchema).optional().default([]),
  prompts: z.array(promptInManifestSchema).optional().default([]),
})

export type PackManifest = z.infer<typeof packManifestSchema>

export interface PackValidationResult {
  valid: boolean
  data?: PackManifest
  error?: string
}

export function validatePackManifest(input: unknown): PackValidationResult {
  const result = packManifestSchema.safeParse(input)
  if (result.success) {
    return { valid: true, data: result.data }
  }
  const first = result.error.issues[0]
  return { valid: false, error: first ? `${first.path.join(".") || "manifest"}: ${first.message}` : "invalid manifest" }
}
