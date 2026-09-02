export interface ValidationResult {
  valid: boolean
  error?: string
}

const VALID_TRANSPORTS = ["http", "sse", "stdio"] as const
const VALID_ROLES = ["system", "user"] as const

export function validateTransport(transport: string): boolean {
  return (VALID_TRANSPORTS as readonly string[]).includes(transport)
}

export function validateSkillInput(input: {
  name?: string
  description?: string
  content?: string
}): ValidationResult {
  if (!input.name || !input.name.trim()) {
    return { valid: false, error: "name is required" }
  }
  if (input.name.length > 64) {
    return { valid: false, error: "name must be ≤64 characters" }
  }
  if (!input.description || !input.description.trim()) {
    return { valid: false, error: "description is required" }
  }
  if (input.description.length > 1024) {
    return { valid: false, error: "description must be ≤1024 characters" }
  }
  if (!input.content) {
    return { valid: false, error: "content is required" }
  }
  return { valid: true }
}

export function validatePromptInput(input: {
  name?: string
  content?: string
  role?: string
}): ValidationResult {
  if (!input.name || !input.name.trim()) {
    return { valid: false, error: "name is required" }
  }
  if (!input.content) {
    return { valid: false, error: "content is required" }
  }
  if (input.role && !(VALID_ROLES as readonly string[]).includes(input.role)) {
    return { valid: false, error: "role must be 'system' or 'user'" }
  }
  return { valid: true }
}

export function validateMcpInput(input: {
  name?: string
  transport?: string
  url?: string
  command?: string
}): ValidationResult {
  if (!input.name || !input.name.trim()) {
    return { valid: false, error: "name is required" }
  }
  if (!input.transport || !validateTransport(input.transport)) {
    return { valid: false, error: "transport must be 'http', 'sse', or 'stdio'" }
  }
  if ((input.transport === "http" || input.transport === "sse") && !input.url) {
    return { valid: false, error: "url is required for http/sse transport" }
  }
  if (input.transport === "stdio" && !input.command) {
    return { valid: false, error: "command is required for stdio transport" }
  }
  return { valid: true }
}