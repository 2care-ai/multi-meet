"use client"

type Props = {
  identity: string
  language?: string
}

export function ParticipantView({ identity, language }: Props) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800">
      <p className="font-medium text-zinc-900 dark:text-zinc-100">{identity}</p>
      {language && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{language}</p>
      )}
    </div>
  )
}
