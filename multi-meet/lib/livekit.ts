import {
  AccessToken,
  RoomServiceClient,
  type VideoGrant,
} from "livekit-server-sdk";
import { RoomAgentDispatch, RoomConfiguration } from "@livekit/protocol";
import { err, ok, type Result } from "neverthrow";

const TRANSCRIBER_AGENT_NAME = "transcriber";
const TRANSLATOR_AGENT_NAME = "translator";

function livekitUrlToHttp(wssUrl: string): string {
  return wssUrl.replace(/^wss:\/\//, "https://").replace(/^ws:\/\//, "http://");
}

function getRoomServiceClient(): Result<
  RoomServiceClient,
  { message: string }
> {
  const url = process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!url || !apiKey || !apiSecret) {
    return err({
      message: "Missing LIVEKIT_URL, LIVEKIT_API_KEY, or LIVEKIT_API_SECRET",
    });
  }
  const httpUrl = livekitUrlToHttp(url);
  return ok(new RoomServiceClient(httpUrl, apiKey, apiSecret));
}

export async function createRoom(
  roomName: string
): Promise<Result<{ name: string }, { message: string }>> {
  const clientResult = getRoomServiceClient();
  if (clientResult.isErr()) return err(clientResult.error);
  try {
    const room = await clientResult.value.createRoom({
      name: roomName,
      emptyTimeout: 10 * 60,
      maxParticipants: 20,
    });
    return ok({ name: room.name });
  } catch (e) {
    return err({
      message: e instanceof Error ? e.message : "Failed to create room",
    });
  }
}

export async function createToken(
  roomName: string,
  identity: string,
  name: string
): Promise<Result<string, { message: string }>> {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!apiKey || !apiSecret) {
    return err({
      message: "Missing LIVEKIT_API_KEY or LIVEKIT_API_SECRET",
    });
  }
  try {
    const at = new AccessToken(apiKey, apiSecret, { identity, name });
    const grant: VideoGrant = {
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
    };
    at.addGrant(grant);
    at.roomConfig = new RoomConfiguration({
      agents: [
        new RoomAgentDispatch({ agentName: TRANSCRIBER_AGENT_NAME }),
        new RoomAgentDispatch({ agentName: TRANSLATOR_AGENT_NAME }),
      ],
    });
    const token = await at.toJwt();
    return ok(token);
  } catch (e) {
    return err({
      message: e instanceof Error ? e.message : "Failed to create token",
    });
  }
}
