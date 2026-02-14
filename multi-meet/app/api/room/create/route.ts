import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { createRoom, createToken } from "@/lib/livekit";
import { setToken as setTokenRedis } from "@/lib/redis";

const MAX_NAME_LEN = 64;
const NAME_REGEX = /^[\w\s.-]+$/;

export async function POST(request: Request) {
  let body: { name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json(
      { error: "Display name is required" },
      { status: 400 }
    );
  }
  if (name.length > MAX_NAME_LEN || !NAME_REGEX.test(name)) {
    return NextResponse.json(
      { error: "Invalid display name" },
      { status: 400 }
    );
  }

  const roomName = nanoid(10);
  const roomResult = await createRoom(roomName);
  if (roomResult.isErr()) {
    return NextResponse.json(
      { error: roomResult.error.message },
      { status: 500 }
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

  console.log("[room/create] Room created", { roomName, creator: name });

  return NextResponse.json({
    token,
    roomName,
    creatorIdentity: identity,
    creatorName: name,
  });
}
