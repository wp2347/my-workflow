export function chunkText(text: string, chunkSize = 500, overlap = 50): string[] {
  const chunks: string[] = []
  let start = 0
  while (start < text.length) {
    let end = start + chunkSize
    if (end >= text.length) {
      chunks.push(text.slice(start).trim())
      break
    }
    // Try to break at a paragraph or sentence boundary
    const slice = text.slice(start, end + overlap)
    const paragraphBreak = slice.lastIndexOf("\n\n")
    const sentenceBreak = slice.lastIndexOf("。")
    const newline = slice.lastIndexOf("\n")

    const breakPoint = paragraphBreak > chunkSize - overlap
      ? paragraphBreak
      : sentenceBreak > chunkSize - overlap
      ? sentenceBreak + 1
      : newline > chunkSize - overlap
      ? newline
      : chunkSize

    end = start + breakPoint
    if (end <= start) end = start + chunkSize
    chunks.push(text.slice(start, Math.min(end, text.length)).trim())
    start = end - overlap
    if (start < 0) start = 0
  }
  return chunks.filter(c => c.length > 10)
}
