"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Send, Loader2, User, Bot, RefreshCw } from "lucide-react"
import { useChatStore, type ChatMessage, type ExecutionNodeState } from "@/stores/chat"
import { useTranslation } from "@/i18n"

interface ChatPanelProps { workflowId: string }

export function ChatPanel({ workflowId }: ChatPanelProps) {
  const { t } = useTranslation()
  const {
    messages, executionNodes, isExecuting,
    addMessage, setExecutionNodes, updateExecutionNode, setIsExecuting, clearMessages,
  } = useChatStore()

  const [input, setInput] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, executionNodes])

  const handleSend = async () => {
    if (!input.trim() || isExecuting) return
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", content: input, timestamp: Date.now() }
    addMessage(userMessage)
    setInput("")
    setIsExecuting(true)

    try {
      const res = await fetch("/api/workflow/run", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflowId, input: { message: input } }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Execution failed")

      const nodeStates: ExecutionNodeState[] = data.logs.map((log: { nodeId: string; nodeType: string; status: string; output?: { raw?: string } }) => ({
        nodeId: log.nodeId, label: log.nodeType?.toUpperCase() || "Unknown",
        status: log.status as ExecutionNodeState["status"],
        output: log.output?.raw || (log.output ? JSON.stringify(log.output) : undefined),
      }))
      setExecutionNodes(nodeStates)

      let finalContent = ""
      if (data.output?.raw) finalContent = data.output.raw
      else if (data.output?.output) finalContent = typeof data.output.output === "string" ? data.output.output : JSON.stringify(data.output.output, null, 2)
      else finalContent = JSON.stringify(data.output, null, 2)

      addMessage({ id: crypto.randomUUID(), role: "assistant", content: finalContent, timestamp: Date.now() })
    } catch (err) {
      addMessage({ id: crypto.randomUUID(), role: "assistant", content: `Error: ${err instanceof Error ? err.message : "Unknown error"}`, timestamp: Date.now() })
    } finally { setIsExecuting(false) }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  return (
    <div className="w-[420px] border-l border-border bg-card flex flex-col h-full">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">{t("chat.title")}</h3>
          <Badge variant="secondary" className="text-xs">{messages.length}</Badge>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={clearMessages}>
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            {t("chat.empty")}
          </div>
        )}
        <div className="space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
              )}
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                {msg.content}
              </div>
              {msg.role === "user" && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                  <User className="h-4 w-4 text-primary-foreground" />
                </div>
              )}
            </div>
          ))}
          {isExecuting && (
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div className="bg-muted rounded-2xl px-4 py-2.5"><Loader2 className="h-4 w-4 animate-spin" /></div>
            </div>
          )}
          {executionNodes.length > 0 && (
            <Card className="p-3 space-y-2">
              <div className="text-xs font-semibold text-muted-foreground">{t("chat.executionDetails")}</div>
              {executionNodes.map((node) => (
                <div key={node.nodeId} className="flex items-center gap-2 text-xs">
                  <Badge variant="outline" className={
                    node.status === "completed" ? "border-success/40 text-success" :
                    node.status === "failed" ? "border-destructive/40 text-destructive" :
                    node.status === "running" ? "border-info/40 text-info" : ""
                  }>
                    {t(`execution.${node.status}` as Parameters<typeof t>[0])}
                  </Badge>
                  <span className="text-muted-foreground">{node.label}</span>
                </div>
              ))}
            </Card>
          )}
        </div>
      </ScrollArea>

      <div className="p-3 border-t border-border">
        <div className="flex gap-2">
          <Input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder={t("chat.placeholder")} disabled={isExecuting} className="flex-1" />
          <Button size="icon" onClick={handleSend} disabled={isExecuting || !input.trim()}>
            {isExecuting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  )
}
