import { Redis } from "@upstash/redis";
import { err, ok, type Result } from "neverthrow";

const TOKEN_TTL_SEC = 3600;
const KEY_PREFIX = "lk_token:";

function getRedis(): Result<Redis, { message: string }> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return err({ message: "Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN" });
  }
  return ok(new Redis({ url, token }));
}

export async function setToken(
  roomName: string,
  identity: string,
  token: string
): Promise<Result<void, { message: string }>> {
  const redisResult = getRedis();
  if (redisResult.isErr()) return err(redisResult.error);
  try {
    const key = `${KEY_PREFIX}${roomName}:${identity}`;
    await redisResult.value.set(key, token, { ex: TOKEN_TTL_SEC });
    return ok(undefined);
  } catch (e) {
    return err({
      message: e instanceof Error ? e.message : "Redis set failed",
    });
  }
}

export async function getToken(
  roomName: string,
  identity: string
): Promise<Result<string | null, { message: string }>> {
  const redisResult = getRedis();
  if (redisResult.isErr()) return err(redisResult.error);
  try {
    const key = `${KEY_PREFIX}${roomName}:${identity}`;
    const value = await redisResult.value.get(key);
    return ok(typeof value === "string" ? value : null);
  } catch (e) {
    return err({
      message: e instanceof Error ? e.message : "Redis get failed",
    });
  }
}
