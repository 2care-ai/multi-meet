import { err, ok } from "neverthrow";

const LIVEKIT_URL = process.env.LIVEKIT_URL ?? "";
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY ?? "";
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET ?? "";

export async function publishTranslatedAudio(
  _roomId: string,
  targetParticipantId: string,
  _audioBuffer: ArrayBuffer
): Promise<import("neverthrow").Result<void, string>> {
  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    return err("LiveKit not configured");
  }
  return ok(undefined);
}
