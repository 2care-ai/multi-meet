"use client"

import { LanguageSelector } from "@/components/LanguageSelector"
import type { Language } from "@/types/translation"
import { useRouter } from "next/navigation"
import { useState } from "react"

const STORAGE_KEYS = {
  token: "multi-meet-token",
  roomId: "multi-meet-roomId",
  userId: "multi-meet-userId",
  language: "multi-meet-language",
} as const

export default function SetupPage() {
  const router = useRouter()
  const [userId, setUserId] = useState("")
  const [language, setLanguage] = useState<Language>("en")
  const [voicePreference, setVoicePreference] = useState("")
  const [roomIdToJoin, setRoomIdToJoin] = useState("")
  const [loading, setLoading] = useState<"create" | "join" | null>(null)
  const [error, setError] = useState("")

  const persistAndRedirect = (token: string, roomId: string, uid: string, lang: string) => {
    if (typeof window === "undefined") return
    sessionStorage.setItem(STORAGE_KEYS.token, token)
    sessionStorage.setItem(STORAGE_KEYS.roomId, roomId)
    sessionStorage.setItem(STORAGE_KEYS.userId, uid)
    sessionStorage.setItem(STORAGE_KEYS.language, lang)
    router.push(`/room/${roomId}`)
  }

  const handleCreate = async () => {
    if (!userId.trim()) {
      setError("Enter your name or user ID")
      return
    }
    setError("")
    setLoading("create")
    try {
      const res = await fetch("/api/room/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userId.trim(),
          language,
          voicePreference: voicePreference || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Failed to create room")
        return
      }
      persistAndRedirect(data.token, data.roomId, userId.trim(), language)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed")
    } finally {
      setLoading(null)
    }
  }

  const handleJoin = async () => {
    if (!userId.trim() || !roomIdToJoin.trim()) {
      setError("Enter your name and room ID")
      return
    }
    setError("")
    setLoading("join")
    try {
      const res = await fetch("/api/room/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userId.trim(),
          roomId: roomIdToJoin.trim(),
          language: language || undefined,
          voicePreference: voicePreference || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Failed to join room")
        return
      }
      persistAndRedirect(data.token, roomIdToJoin.trim(), userId.trim(), language)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed")
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-6 font-sans dark:bg-zinc-950">
      <div className="w-full max-w-md space-y-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Setup
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Create a room to get a room URL, or paste a room ID below to join someone else’s room.
        </p>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Your name / ID
          </label>
          <input
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="e.g. Alice"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Language
          </label>
          <LanguageSelector value={language} onChange={setLanguage} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Voice (optional)
          </label>
          <input
            type="text"
            value={voicePreference}
            onChange={(e) => setVoicePreference(e.target.value)}
            placeholder="Voice ID"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={handleCreate}
            disabled={!!loading}
            className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {loading === "create" ? "Creating…" : "Create room"}
          </button>
          <div className="flex gap-2">
            <input
              type="text"
              value={roomIdToJoin}
              onChange={(e) => setRoomIdToJoin(e.target.value)}
              placeholder="Room ID to join"
              className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
            <button
              type="button"
              onClick={handleJoin}
              disabled={!!loading}
              className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300"
            >
              {loading === "join" ? "Joining…" : "Join"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
