"use client"

import { useLocaleStore } from "@/stores/locale"

export function useTranslation() {
  const t = useLocaleStore((s) => s.t)
  const locale = useLocaleStore((s) => s.locale)
  const setLocale = useLocaleStore((s) => s.setLocale)
  return { t, locale, setLocale }
}
