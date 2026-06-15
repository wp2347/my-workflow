"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Key, Plus, Loader2, Trash2, Eye, EyeOff, Shield } from "lucide-react"

interface Credential {
  id: string; name: string; type: string; scope: string; createdAt: string; updatedAt: string
}

export default function CredentialsPage() {
  const [creds, setCreds] = useState<Credential[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState("")
  const [value, setValue] = useState("")
  const [type, setType] = useState("api_key")
  const [scope, setScope] = useState("global")
  const [creating, setCreating] = useState(false)
  const [revealed, setRevealed] = useState<Record<string, string>>({})
  const [copied, setCopied] = useState<Record<string, boolean>>({})
  const [toDelete, setToDelete] = useState<Credential | null>(null)

  const fetchCreds = useCallback(() => {
    setLoading(true)
    fetch("/api/credentials")
      .then(r => r.json())
      .then(data => setCreds(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchCreds() }, [fetchCreds])

  const handleCreate = async () => {
    if (!name || !value) return
    setCreating(true)
    const res = await fetch("/api/credentials", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, type, value, scope }),
    })
    if (res.ok) { setShowCreate(false); setName(""); setValue(""); fetchCreds() }
    setCreating(false)
  }

  const handleDelete = async () => {
    if (!toDelete) return
    await fetch(`/api/credentials/${toDelete.id}`, { method: "DELETE" })
    setToDelete(null); fetchCreds()
  }

  const toggleReveal = async (id: string) => {
    if (revealed[id]) { setRevealed(prev => { const n = { ...prev }; delete n[id]; return n }); return }
    const res = await fetch(`/api/credentials/${id}`)
    const data = await res.json()
    setRevealed(prev => ({ ...prev, [id]: data.value || "" }))
  }

  const copyValue = (id: string) => {
    const val = revealed[id]; if (!val) return
    navigator.clipboard.writeText(val)
    setCopied(prev => ({ ...prev, [id]: true }))
    setTimeout(() => setCopied(prev => ({ ...prev, [id]: false })), 2000)
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Shield className="h-6 w-6" />凭证管理</h1>
          <p className="text-muted-foreground mt-1">AES-256 加密存储，点击眼睛查看明文，点击密钥复制</p>
        </div>
        <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-2" />添加凭证</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : creds.length === 0 ? (
        <Card className="p-12 text-center">
          <Key className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-1">暂无凭证</h3>
          <p className="text-muted-foreground mb-4">添加 API Key 等敏感凭证</p>
          <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-2" />添加凭证</Button>
        </Card>
      ) : (
        <div className="space-y-2">
          {creds.map((c) => (
            <Card key={c.id}>
              <CardHeader className="py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Key className="h-5 w-5 text-yellow-500 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{c.name}</span>
                        <Badge variant="secondary" className="text-[10px]">{c.type}</Badge>
                        <Badge variant="outline" className="text-[10px]">{c.scope}</Badge>
                      </div>
                      <code
                        className="mt-1 inline-block text-xs bg-muted px-2 py-0.5 rounded font-mono cursor-pointer hover:bg-muted/80 transition-colors select-all max-w-full truncate"
                        onClick={() => revealed[c.id] && copyValue(c.id)}
                        title={revealed[c.id] ? "点击复制" : "点击眼睛查看"}
                      >
                        {revealed[c.id]
                          ? revealed[c.id]
                          : `••••••••••••••••••••••••••••••••••••••••`}
                      </code>
                      {copied[c.id] && <span className="text-[10px] text-green-500 ml-1">已复制</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleReveal(c.id)}>
                      {revealed[c.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setToDelete(c)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>添加凭证</DialogTitle><DialogDescription>AES-256 加密存储到数据库</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>名称</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="如 DeepSeek API Key" /></div>
            <div className="space-y-2"><Label>类型</Label>
              <Select value={type} onValueChange={(v) => v && setType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="api_key">API Key</SelectItem><SelectItem value="secret">Secret</SelectItem>
                  <SelectItem value="token">Token</SelectItem><SelectItem value="password">Password</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>值</Label><Input type="password" value={value} onChange={e => setValue(e.target.value)} placeholder="sk-..." /></div>
            <div className="space-y-2"><Label>作用域</Label>
              <Select value={scope} onValueChange={(v) => v && setScope(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">全局</SelectItem><SelectItem value="workflow">工作流</SelectItem><SelectItem value="node">节点</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>取消</Button>
            <Button onClick={handleCreate} disabled={creating || !name || !value}>{creating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>删除凭证</DialogTitle><DialogDescription>确定删除 "{toDelete?.name}"？不可撤销。</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToDelete(null)}>取消</Button>
            <Button variant="destructive" onClick={handleDelete}>删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
