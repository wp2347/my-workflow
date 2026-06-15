"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Loader2, Plus, Trash2, FileText, Upload, Database } from "lucide-react"

interface DocInfo {
  id: string; name: string; type: string; chunkSize: number; createdAt: string
  _count?: { chunks: number }
}

export default function KnowledgePage() {
  const [docs, setDocs] = useState<DocInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const fetchDocs = useCallback(() => {
    setLoading(true)
    fetch("/api/documents").then(r => r.json()).then(setDocs).catch(console.error).finally(() => setLoading(false))
  }, [])
  useEffect(() => { fetchDocs() }, [fetchDocs])

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    setUploading(true)
    const file = fileRef.current?.files?.[0]
    const form = new FormData()
    if (file) form.append("file", file)
    else {
      const content = (document.getElementById("doc-content") as HTMLTextAreaElement)?.value
      const name = (document.getElementById("doc-name") as HTMLInputElement)?.value
      if (!content) { setUploading(false); return }
      form.append("content", content)
      form.append("name", name || "手动输入")
    }
    await fetch("/api/documents", { method: "POST", body: form })
    setUploading(false); setShowAdd(false); fetchDocs()
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/documents/${id}`, { method: "DELETE" })
    fetchDocs()
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold flex items-center gap-2"><Database className="h-6 w-6" />知识库</h1>
          <p className="text-muted-foreground mt-1">上传文档，向量化后用于 RAG 检索增强生成</p></div>
        <Button onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-2" />添加文档</Button>
      </div>

      {loading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
        : docs.length === 0 ? (
          <Card className="p-12 text-center"><FileText className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-1">暂无文档</h3><p className="text-muted-foreground mb-4">上传 PDF/TXT/Markdown 构建知识库</p>
            <Button onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-2" />添加文档</Button></Card>
        ) : (
          <div className="space-y-2">
            {docs.map(d => (
              <Card key={d.id} className="group">
                <CardHeader className="flex flex-row items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-blue-500" />
                    <div>
                      <CardTitle className="text-sm">{d.name}</CardTitle>
                      <CardDescription>{d._count?.chunks || 0} 个分块 · {d.type}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">{d.chunkSize}字/块</Badge>
                    <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100" onClick={() => handleDelete(d.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" /></Button>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>添加文档</DialogTitle></DialogHeader>
          <form onSubmit={handleUpload} className="space-y-4">
            <div><Label>上传文件</Label><Input ref={fileRef} type="file" accept=".txt,.md,.csv,.json" /></div>
            <div className="text-xs text-muted-foreground text-center">或手动输入</div>
            <div><Label>文档名</Label><Input id="doc-name" placeholder="文档名称" /></div>
            <div><Label>内容</Label><Textarea id="doc-content" rows={6} placeholder="粘贴文档内容..." /></div>
            <DialogFooter><Button variant="outline" type="button" onClick={() => setShowAdd(false)}>取消</Button>
              <Button type="submit" disabled={uploading}>{uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}上传</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
