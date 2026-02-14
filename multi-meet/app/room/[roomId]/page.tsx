"use client"

import { TranslationRoom } from "@/components/TranslationRoom"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"

const STORAGE_KEYS = {
  token: "multi-meet-token",
  roomId: "multi-meet-roomId",
  userId: "multi-meet-userId",
  language: "multi-meet-language",
} as const

export default function RoomPage() {
  const params = useParams()
  const router = useRouter()
  const roomId = params.roomId as string
  const [token, setToken] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [language, setLanguage] = useState<string>("en")
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    const storedToken = sessionStorage.getItem(STORAGE_KEYS.token)
    const storedRoomId = sessionStorage.getItem(STORAGE_KEYS.roomId)
    const storedUserId = sessionStorage.getItem(STORAGE_KEYS.userId)
    const storedLanguage = sessionStorage.getItem(STORAGE_KEYS.language)
    if (storedToken && storedRoomId === roomId) {
      setToken(storedToken)
      setUserId(storedUserId ?? null)
      setLanguage(storedLanguage ?? "en")
    } else {
      setMissing(true)
    }
  }, [roomId])

  if (missing) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
        <p className="text-zinc-600 dark:text-zinc-400">
          No session for this room. Create or join a room from setup.
        </p>
        <button
          type="button"
          onClick={() => router.push("/setup")}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Go to setup
        </button>
      </div>
    )
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-zinc-500">Loading…</p>
      </div>
    )
  }

  return (
    <TranslationRoom
      token={token}
      roomId={roomId}
      speakerId={userId ?? "unknown"}
      speakerLanguage={language}
    />
  )
}
