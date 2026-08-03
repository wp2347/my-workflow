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
import { useTranslation } from "@/i18n"

interface Credential {
  id: string; name: string; type: string; scope: string; createdAt: string; updatedAt: string
}

export default function CredentialsPage() {
  const { t } = useTranslation()
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
          <h1 className="text-2xl font-bold flex items-center gap-2"><Shield className="h-6 w-6" />{t("credentials.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("credentials.description")}</p>
        </div>
        <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-2" />{t("credentials.add")}</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : creds.length === 0 ? (
        <Card className="p-12 text-center">
          <Key className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-1">{t("credentials.noCreds")}</h3>
          <p className="text-muted-foreground mb-4">{t("credentials.noCredsDesc")}</p>
          <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-2" />{t("credentials.add")}</Button>
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
                        title={revealed[c.id] ? t("credentials.copy") : t("credentials.view")}
                      >
                        {revealed[c.id]
                          ? revealed[c.id]
                          : `••••••••••••••••••••••••••••••••••••••••`}
                      </code>
                      {copied[c.id] && <span className="text-[10px] text-green-500 ml-1">{t("credentials.copied")}</span>}
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
          <DialogHeader><DialogTitle>{t("credentials.addTitle")}</DialogTitle><DialogDescription>{t("credentials.addDesc")}</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>{t("credentials.name")}</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder={t("credentials.namePlaceholder")} /></div>
            <div className="space-y-2"><Label>{t("credentials.type")}</Label>
              <Select value={type} onValueChange={(v) => v && setType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="api_key">API Key</SelectItem><SelectItem value="secret">Secret</SelectItem>
                  <SelectItem value="token">Token</SelectItem><SelectItem value="password">Password</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>{t("credentials.value")}</Label><Input type="password" value={value} onChange={e => setValue(e.target.value)} placeholder="sk-..." /></div>
            <div className="space-y-2"><Label>{t("credentials.scope")}</Label>
              <Select value={scope} onValueChange={(v) => v && setScope(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">{t("credentials.global")}</SelectItem><SelectItem value="workflow">{t("credentials.workflow")}</SelectItem><SelectItem value="node">{t("credentials.node")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>{t("credentials.cancel")}</Button>
            <Button onClick={handleCreate} disabled={creating || !name || !value}>{creating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}{t("credentials.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("credentials.deleteTitle")}</DialogTitle><DialogDescription>{t("credentials.deleteDesc", { name: toDelete?.name || "" })}</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToDelete(null)}>{t("credentials.cancel")}</Button>
            <Button variant="destructive" onClick={handleDelete}>{t("credentials.delete")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
