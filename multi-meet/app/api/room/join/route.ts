import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { createToken } from "@/lib/livekit";
import { setToken as setTokenRedis } from "@/lib/redis";

const MAX_NAME_LEN = 64;
const MAX_ROOM_LEN = 64;
const NAME_REGEX = /^[\w\s.-]+$/;
const ROOM_REGEX = /^[\w-]+$/;

export async function POST(request: Request) {
  let body: { roomName?: string; name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }
  const roomName =
    typeof body.roomName === "string" ? body.roomName.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!roomName || !name) {
    return NextResponse.json(
      { error: "Room name and display name are required" },
      { status: 400 }
    );
  }
  if (
    roomName.length > MAX_ROOM_LEN ||
    !ROOM_REGEX.test(roomName) ||
    name.length > MAX_NAME_LEN ||
    !NAME_REGEX.test(name)
  ) {
    return NextResponse.json(
      { error: "Invalid room name or display name" },
      { status: 400 }
    );
  }

  const identity = `${name}-${nanoid(6)}`;
  const tokenResult = await createToken(roomName, identity, name);
  if (tokenResult.isErr()) {
    return NextResponse.json(
      { error: tokenResult.error.message },
      { status: 500 }
    );
  }

  const token = tokenResult.value;
  const _stored = await setTokenRedis(roomName, identity, token);

  return NextResponse.json({
    token,
  });
}
