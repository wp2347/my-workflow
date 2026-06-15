const pendingCallbacks = new Map<string, {
  resolve: (data: { message: string; chatId: string }) => void
  timeout: ReturnType<typeof setTimeout>
}>()

export function waitForFeishuMessage(eventId: string, timeoutMs = 30000): Promise<{ message: string; chatId: string }> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingCallbacks.delete(eventId)
      reject(new Error("Timeout waiting for Feishu message"))
    }, timeoutMs)
    pendingCallbacks.set(eventId, { resolve, timeout })
  })
}

export function resolveFeishuMessage(message: string, chatId: string) {
  for (const [key, cb] of pendingCallbacks) {
    clearTimeout(cb.timeout)
    cb.resolve({ message, chatId })
    pendingCallbacks.delete(key)
  }
}

export function hasPendingCallback(): boolean {
  return pendingCallbacks.size > 0
}
