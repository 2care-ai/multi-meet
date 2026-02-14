import {
  AccessToken,
  DataPacket_Kind,
  RoomServiceClient,
} from "livekit-server-sdk"
import { ResultAsync } from "neverthrow"
import type { TranslationRoomMessage } from "@/types/translation"

function getRoomServiceClient(): RoomServiceClient {
  const url = process.env.LIVEKIT_URL
  const apiKey = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET
  if (!url || !apiKey || !apiSecret)
    throw new Error("LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET must be set")
  return new RoomServiceClient(url, apiKey, apiSecret)
}

export function createLiveKitRoom(roomId: string): ResultAsync<void, Error> {
  return ResultAsync.fromPromise(
    (async () => {
      const client = getRoomServiceClient()
      await client.createRoom({
        name: roomId,
        emptyTimeout: 10 * 60,
        maxParticipants: 20,
      })
    })(),
    (e) => (e instanceof Error ? e : new Error(String(e)))
  )
}

export function sendTranslationData(
  roomId: string,
  payload: TranslationRoomMessage
): ResultAsync<void, Error> {
  return ResultAsync.fromPromise(
    (async () => {
      const client = getRoomServiceClient()
      const data = new TextEncoder().encode(JSON.stringify(payload))
      await client.sendData(roomId, data, DataPacket_Kind.RELIABLE, {
        topic: "translation",
      })
    })(),
    (e) => (e instanceof Error ? e : new Error(String(e)))
  )
}

export function createLiveKitToken(
  roomId: string,
  participantIdentity: string,
  participantName?: string
): ResultAsync<string, Error> {
  return ResultAsync.fromPromise(
    (async () => {
      const apiKey = process.env.LIVEKIT_API_KEY
      const apiSecret = process.env.LIVEKIT_API_SECRET
      if (!apiKey || !apiSecret)
        throw new Error("LIVEKIT_API_KEY and LIVEKIT_API_SECRET must be set")
      const at = new AccessToken(apiKey, apiSecret, {
        identity: participantIdentity,
        name: participantName ?? participantIdentity,
      })
      at.addGrant({ roomJoin: true, room: roomId, canPublish: true, canSubscribe: true })
      return await at.toJwt()
    })(),
    (e) => (e instanceof Error ? e : new Error(String(e)))
  )
}
