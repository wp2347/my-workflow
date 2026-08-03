"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTranslation } from "@/i18n"

interface CredentialSelectProps {
  credentialId?: string
  onSelect: (id: string) => void
  onClear: () => void
}

interface CredentialOption { id: string; name: string }

const MANUAL = "__manual__"

export function CredentialSelect({ credentialId, onSelect, onClear }: CredentialSelectProps) {
  const { t } = useTranslation()
  const [creds, setCreds] = useState<CredentialOption[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch("/api/credentials")
      .then((r) => r.json())
      .then((data: CredentialOption[]) => {
        setCreds(Array.isArray(data) ? data.filter((c) => c && typeof c.id === "string") : [])
      })
      .catch(() => setCreds([]))
      .finally(() => setLoaded(true))
  }, [])

  const value = credentialId || MANUAL

  return (
    <div className="space-y-2">
      <Select value={value} onValueChange={(v) => (v && v !== MANUAL ? onSelect(v) : onClear())}>
        <SelectTrigger><SelectValue placeholder={t("config.selectCredential")} /></SelectTrigger>
        <SelectContent>
          <SelectItem value={MANUAL}>{t("config.credentialManual")}</SelectItem>
          {creds.map((c) => (
            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {loaded && creds.length === 0 && (
        <p className="text-[10px] text-muted-foreground">
          {t("config.noCredential")}{" "}
          <Link href="/credentials" className="text-primary hover:underline">{t("config.credentialLink")}</Link>
        </p>
      )}
    </div>
  )
}
