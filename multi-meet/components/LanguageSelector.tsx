"use client"

import { LANGUAGES, type Language } from "@/types/translation"

const LABELS: Record<Language, string> = {
  en: "English",
  ta: "Tamil",
  hi: "Hindi",
  kn: "Kannada",
}

type Props = {
  value: Language
  onChange: (value: Language) => void
}

export function LanguageSelector({ value, onChange }: Props) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as Language)}
      className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
    >
      {LANGUAGES.map((lang) => (
        <option key={lang} value={lang}>
          {LABELS[lang]}
        </option>
      ))}
    </select>
  )
}
