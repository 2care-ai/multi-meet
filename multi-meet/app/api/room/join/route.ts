import { createLiveKitToken } from "@/lib/livekit"
import { getRoom, getUserConfig, setUserConfig, addRoomMember } from "@/lib/redis"
import { LANGUAGES, type Language, type UserConfig } from "@/types/translation"
import { NextResponse } from "next/server"

type JoinBody = {
  userId: string
  roomId: string
  language?: string
  voicePreference?: string
}

export async function POST(request: Request) {
  const body = (await request.json()) as JoinBody
  const { userId, roomId, language, voicePreference } = body
  if (!userId || !roomId) {
    return NextResponse.json(
      { error: "userId and roomId are required" },
      { status: 400 }
    )
  }
  const roomResult = await getRoom(roomId)
  if (roomResult.isErr()) {
    return NextResponse.json(
      { error: roomResult.error.message },
      { status: 500 }
    )
  }
  if (!roomResult.value) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 })
  }
  if (language && !LANGUAGES.includes(language as Language)) {
    return NextResponse.json(
      { error: "Language must be one of: en, ta, hi, kn" },
      { status: 400 }
    )
  }
  const now = new Date().toISOString()
  const existing = await getUserConfig(userId, roomId)
  if (existing.isErr()) {
    return NextResponse.json(
      { error: existing.error.message },
      { status: 500 }
    )
  }
  const userConfig: UserConfig = existing.value
    ? {
        ...existing.value,
        language: language ?? existing.value.language,
        voiceId: voicePreference ?? existing.value.voiceId,
        updatedAt: now,
      }
    : {
        userId,
        language: language ?? "en",
        voiceId: voicePreference,
        roomId,
        createdAt: now,
        updatedAt: now,
      }
  const setConfigResult = await setUserConfig(userConfig)
  if (setConfigResult.isErr()) {
    return NextResponse.json(
      { error: setConfigResult.error.message },
      { status: 500 }
    )
  }
  const addMemberResult = await addRoomMember(roomId, userId)
  if (addMemberResult.isErr()) {
    return NextResponse.json(
      { error: addMemberResult.error.message },
      { status: 500 }
    )
  }
  const tokenResult = await createLiveKitToken(roomId, userId)
  if (tokenResult.isErr()) {
    return NextResponse.json(
      { error: tokenResult.error.message },
      { status: 500 }
    )
  }
  return NextResponse.json({ token: tokenResult.value })
}
