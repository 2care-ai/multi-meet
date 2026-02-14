import Redis from "ioredis"
import { errAsync, okAsync, ResultAsync } from "neverthrow"
import type { Room, UserConfig } from "@/types/translation"

const getClient = (): Redis => {
  const url = process.env.REDIS_URL
  if (!url) throw new Error("REDIS_URL is not set")
  return new Redis(url)
}

const roomKey = (roomId: string) => `room:${roomId}`
const userConfigKey = (userId: string, roomId: string) =>
  `userconfig:${userId}:${roomId}`
const roomMembersKey = (roomId: string) => `room:${roomId}:members`

export function getRoom(roomId: string): ResultAsync<Room | null, Error> {
  return ResultAsync.fromPromise(
    (async () => {
      const redis = getClient()
      try {
        const raw = await redis.get(roomKey(roomId))
        if (!raw) return null
        return JSON.parse(raw) as Room
      } finally {
        redis.disconnect()
      }
    })(),
    (e) => (e instanceof Error ? e : new Error(String(e)))
  )
}

export function setRoom(room: Room): ResultAsync<void, Error> {
  return ResultAsync.fromPromise(
    (async () => {
      const redis = getClient()
      try {
        await redis.set(roomKey(room.id), JSON.stringify(room))
      } finally {
        redis.disconnect()
      }
    })(),
    (e) => (e instanceof Error ? e : new Error(String(e)))
  )
}

export function getUserConfig(
  userId: string,
  roomId: string
): ResultAsync<UserConfig | null, Error> {
  return ResultAsync.fromPromise(
    (async () => {
      const redis = getClient()
      try {
        const raw = await redis.get(userConfigKey(userId, roomId))
        if (!raw) return null
        return JSON.parse(raw) as UserConfig
      } finally {
        redis.disconnect()
      }
    })(),
    (e) => (e instanceof Error ? e : new Error(String(e)))
  )
}

export function setUserConfig(config: UserConfig): ResultAsync<void, Error> {
  return ResultAsync.fromPromise(
    (async () => {
      const redis = getClient()
      try {
        await redis.set(
          userConfigKey(config.userId, config.roomId),
          JSON.stringify(config)
        )
      } finally {
        redis.disconnect()
      }
    })(),
    (e) => (e instanceof Error ? e : new Error(String(e)))
  )
}

export function addRoomMember(
  roomId: string,
  userId: string
): ResultAsync<void, Error> {
  return ResultAsync.fromPromise(
    (async () => {
      const redis = getClient()
      try {
        await redis.sadd(roomMembersKey(roomId), userId)
      } finally {
        redis.disconnect()
      }
    })(),
    (e) => (e instanceof Error ? e : new Error(String(e)))
  )
}

export function getRoomMembers(roomId: string): ResultAsync<string[], Error> {
  return ResultAsync.fromPromise(
    (async () => {
      const redis = getClient()
      try {
        const members = await redis.smembers(roomMembersKey(roomId))
        return members
      } finally {
        redis.disconnect()
      }
    })(),
    (e) => (e instanceof Error ? e : new Error(String(e)))
  )
}
