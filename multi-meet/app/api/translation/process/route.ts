import { NextResponse } from "next/server";
import { processParticipantAudio } from "@/lib/translation-pipeline";
import { publishTranslatedAudio } from "@/lib/audio-publisher";
import type { ProcessTranslationRequest, ProcessTranslationResponse } from "@/types/pipeline";

export async function POST(req: Request): Promise<NextResponse<ProcessTranslationResponse>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { roomId, speakerId, speakerLanguage, audioBase64, targetParticipants } = body as ProcessTranslationRequest;

  if (!roomId || !speakerId || !speakerLanguage || !Array.isArray(targetParticipants)) {
    return NextResponse.json(
      { ok: false, error: "Missing roomId, speakerId, speakerLanguage or targetParticipants" },
      { status: 400 }
    );
  }

  const audioBuffer = audioBase64
    ? Buffer.from(audioBase64, "base64")
    : Buffer.alloc(0);

  if (audioBuffer.length === 0) {
    return NextResponse.json({ ok: false, error: "No audio data" }, { status: 400 });
  }

  const result = await processParticipantAudio(audioBuffer, speakerLanguage, targetParticipants);

  if (result.isErr()) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  for (const item of result.value) {
    const pub = await publishTranslatedAudio(roomId, item.participantId, item.audioBuffer);
    if (pub.isErr()) {
      // log but don't fail the request
    }
  }

  return NextResponse.json({ ok: true });
}
