import path from "path"

export const ALLOWED_ROOT = path.resolve(process.env.OFFICE_ALLOWED_DIR || path.join(process.cwd(), "storage"))

export function resolveAllowedPath(outputPath: string): string {
  const resolved = path.resolve(process.cwd(), outputPath)
  const relative = path.relative(ALLOWED_ROOT, resolved)
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`outputPath must be inside ${ALLOWED_ROOT}`)
  }
  return resolved
}
