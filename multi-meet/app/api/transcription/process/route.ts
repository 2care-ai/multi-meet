import { NextResponse } from "next/server";
import { transcribeAudio } from "@/lib/elevenlabs-stt";

export async function POST(request: Request) {
  let body: { audioBase64?: string; sourceLang?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }
  const { audioBase64, sourceLang } = body;
  if (!audioBase64 || typeof sourceLang !== "string") {
    return NextResponse.json(
      { ok: false, error: "audioBase64 and sourceLang are required" },
      { status: 400 }
    );
  }
  const apiKey = process.env.ELEVEN_API_KEY ?? "";
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "Missing ELEVEN_API_KEY" }, { status: 500 });
  }
  let audio: Buffer;
  try {
    audio = Buffer.from(audioBase64, "base64");
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid base64 audio" }, { status: 400 });
  }
  const result = await transcribeAudio(audio, apiKey, sourceLang.trim() || undefined);
  if (result.isErr()) {
    return NextResponse.json(
      { ok: false, error: result.error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, transcript: result.value });
}
