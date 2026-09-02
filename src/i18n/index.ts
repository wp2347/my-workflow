"use client"

import { useEffect } from "react"
import { useLocaleStore } from "@/stores/locale"

export function useTranslation() {
  const t = useLocaleStore((s) => s.t)
  const locale = useLocaleStore((s) => s.locale)
  const setLocale = useLocaleStore((s) => s.setLocale)
  const hydrateLocale = useLocaleStore((s) => s.hydrateLocale)

  useEffect(() => {
    hydrateLocale()
  }, [hydrateLocale])

  return { t, locale, setLocale }
}
