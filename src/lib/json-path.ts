export function getByPath(obj: unknown, path: string): unknown {
  const keys = path.split(".")
  let current = obj
  for (const key of keys) {
    if (current == null) return undefined
    // Array index: data[0].field
    const arrMatch = key.match(/^(\w+)\[(\d+)\]$/)
    if (arrMatch) {
      const arr = (current as Record<string, unknown>)[arrMatch[1]]
      current = Array.isArray(arr) ? arr[parseInt(arrMatch[2])] : undefined
      continue
    }
    current = (current as Record<string, unknown>)[key]
  }
  return current
}