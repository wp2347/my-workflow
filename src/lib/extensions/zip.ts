import JSZip from "jszip"

export const MAX_UPLOAD_SIZE = 10 * 1024 * 1024 // 10MB

export interface ZipFile {
  name: string
  content: string
}

/** 打包文件列表为 zip Buffer */
export async function createZip(files: ZipFile[]): Promise<Buffer> {
  const zip = new JSZip()
  for (const file of files) {
    zip.file(file.name, file.content)
  }
  const result = await zip.generateAsync({ type: "nodebuffer" })
  return Buffer.from(result)
}

/** 解压 zip Buffer 为文件列表 */
export async function extractZip(zipBuffer: Buffer): Promise<ZipFile[]> {
  const zip = await JSZip.loadAsync(zipBuffer)
  const files: ZipFile[] = []
  const entries = Object.values(zip.files)
  for (const entry of entries) {
    if (entry.dir) continue
    const content = await entry.async("string")
    files.push({ name: entry.name, content })
  }
  return files
}

/**
 * 校验 zip 内所有路径不含路径穿越攻击。
 * 拒绝含 ".." 或绝对路径(以 / 开头或含盘符)的条目。
 */
export function validateZipPaths(entryNames: string[]): boolean {
  for (const name of entryNames) {
    if (name.includes("..")) return false
    if (name.startsWith("/")) return false
    if (/^[a-zA-Z]:[\\/]/.test(name)) return false
  }
  return true
}