"use client"

import { useState, useRef, useEffect } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Send, Loader2, Bot, User, MessageSquare } from "lucide-react"

interface Message { id: string; role: "user" | "assistant"; content: string }

export default function WidgetPage() {
  const params = useParams()
  const workflowId = params.workflowId as string
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight) }, [messages])

  const send = async () => {
    if (!input.trim() || loading) return
    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: input }
    setMessages(prev => [...prev, userMsg])
    setInput("")
    setLoading(true)

    try {
      const res = await fetch("/api/workflow/run", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflowId, input: { message: input } }),
      })
      const data = await res.json()
      const output = data.output
      let content = output?.message || output?.text || output?.raw || JSON.stringify(output)
      if (typeof content === "object") content = JSON.stringify(content)
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: "assistant", content }])
    } catch {
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: "assistant", content: "请求失败，请重试" }])
    } finally { setLoading(false) }
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <div className="h-12 border-b flex items-center px-4 gap-2 bg-card">
        <MessageSquare className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">AI Chat</span>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground mt-20">发送消息开始对话</div>
        )}
        {messages.map(m => (
          <div key={m.id} className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}>
            {m.role === "assistant" && <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0"><Bot className="h-4 w-4 text-primary" /></div>}
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{m.content}</div>
            {m.role === "user" && <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0"><User className="h-4 w-4 text-primary-foreground" /></div>}
          </div>
        ))}
        {loading && <div className="flex gap-3"><div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center"><Bot className="h-4 w-4 text-primary" /></div><div className="bg-muted rounded-2xl px-4 py-2.5"><Loader2 className="h-4 w-4 animate-spin" /></div></div>}
      </div>
      <div className="p-3 border-t">
        <div className="flex gap-2">
          <Input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") send() }} placeholder="输入消息..." disabled={loading} />
          <Button size="icon" onClick={send} disabled={loading}><Send className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  )
}
