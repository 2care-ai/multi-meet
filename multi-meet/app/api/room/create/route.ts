import { createLiveKitRoom, createLiveKitToken } from "@/lib/livekit"
import {
  addRoomMember,
  setRoom,
  setUserConfig,
} from "@/lib/redis"
import { LANGUAGES, type Language, type Room, type UserConfig } from "@/types/translation"
import { NextResponse } from "next/server"
import { randomUUID } from "crypto"

type CreateBody = {
  userId: string
  language: string
  voicePreference?: string
}

export async function POST(request: Request) {
  const body = (await request.json()) as CreateBody
  const { userId, language, voicePreference } = body
  if (!userId || !language) {
    return NextResponse.json(
      { error: "userId and language are required" },
      { status: 400 }
    )
  }
  if (!LANGUAGES.includes(language as Language)) {
    return NextResponse.json(
      { error: "Language must be one of: en, ta, hi, kn" },
      { status: 400 }
    )
  }
  const roomId = randomUUID()
  const now = new Date().toISOString()
  const room: Room = { id: roomId, createdAt: now }
  const userConfig: UserConfig = {
    userId,
    language,
    voiceId: voicePreference,
    roomId,
    createdAt: now,
    updatedAt: now,
  }
  const setRoomResult = await setRoom(room)
  if (setRoomResult.isErr()) {
    return NextResponse.json(
      { error: setRoomResult.error.message },
      { status: 500 }
    )
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
  const createRoomResult = await createLiveKitRoom(roomId)
  if (createRoomResult.isErr()) {
    return NextResponse.json(
      { error: createRoomResult.error.message },
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
  return NextResponse.json({ token: tokenResult.value, roomId })
}
