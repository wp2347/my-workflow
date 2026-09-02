export interface FrontmatterResult {
  name?: string
  description?: string
  body: string
}

/**
 * 解析 markdown frontmatter(name + description)。
 * 使用正则解析,不引入 gray-matter 依赖。
 */
export function parseFrontmatter(md: string): FrontmatterResult {
  const match = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
  if (!match) {
    return { body: md }
  }
  const yaml = match[1]
  const name = yaml.match(/^name:\s*(.+)$/m)?.[1]?.trim()
  const description = yaml.match(/^description:\s*(.+)$/m)?.[1]?.trim()
  return { name, description, body: match[2] }
}