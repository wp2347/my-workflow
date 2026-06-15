"use client"

import { create } from "zustand"

export type Locale = "en" | "zh"

interface LocaleStore {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, params?: Record<string, string | number>) => string
}

import en from "@/i18n/locales/en.json"
import zh from "@/i18n/locales/zh.json"

const messages: Record<Locale, Record<string, unknown>> = { en, zh }

function getNested(obj: Record<string, unknown>, path: string): string | undefined {
  const keys = path.split(".")
  let current: unknown = obj
  for (const key of keys) {
    if (typeof current !== "object" || current === null) return undefined
    current = (current as Record<string, unknown>)[key]
  }
  return typeof current === "string" ? current : undefined
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? `{${key}}`))
}

export const useLocaleStore = create<LocaleStore>((set, get) => ({
  locale: "zh",

  setLocale: (locale: Locale) => {
    set({ locale })
    if (typeof window !== "undefined") {
      localStorage.setItem("workflow-locale", locale)
    }
  },

  t: (key: string, params?: Record<string, string | number>) => {
    const { locale } = get()
    const value = getNested(messages[locale], key)
    if (value) return interpolate(value, params)
    const fallback = getNested(messages.en, key)
    return fallback ? interpolate(fallback, params) : key
  },
}))

if (typeof window !== "undefined") {
  const stored = localStorage.getItem("workflow-locale") as Locale | null
  if (stored === "en" || stored === "zh") {
    useLocaleStore.setState({ locale: stored })
  }
}
