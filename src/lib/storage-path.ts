import path from "path"

/** storage 根目录（与 /api/storage/files 一致） */
export const STORAGE_ROOT = process.env.STORAGE_DIR || path.join(process.cwd(), "storage")

/**
 * 把查询参数 path 解析成 storage 根内的绝对路径。
 * path 接受两种形式：
 *   - storage 相对路径（如 "export/报告.docx"）
 *   - 绝对路径（必须在 storage 根内）
 * 返回 null 表示路径不合法（越界）。
 */
export function resolveStoragePath(raw: string): string | null {
  const abs = path.isAbsolute(raw) ? path.normalize(raw) : path.resolve(STORAGE_ROOT, raw)
  const rel = path.relative(STORAGE_ROOT, abs)
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null
  return abs
}
