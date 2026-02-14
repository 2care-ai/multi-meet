import { NextResponse } from "next/server";
import { transcribeAudio } from "@/lib/elevenlabs-stt";
import { translateText } from "@/lib/gemini-translate";

const CAPTION_LANGS = ["en", "hi", "ta"] as const;

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
  const elevenKey = process.env.ELEVEN_API_KEY ?? "";
  const geminiKey = process.env.GEMINI_API_KEY ?? "";
  if (!elevenKey || !geminiKey) {
    return NextResponse.json(
      { ok: false, error: "Missing ELEVEN_API_KEY or GEMINI_API_KEY" },
      { status: 500 }
    );
  }
  let audio: Buffer;
  try {
    audio = Buffer.from(audioBase64, "base64");
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid base64 audio" }, { status: 400 });
  }

  const transcriptResult = await transcribeAudio(audio, elevenKey, sourceLang.trim() || undefined);
  if (transcriptResult.isErr()) {
    return NextResponse.json(
      { ok: false, error: transcriptResult.error.message },
      { status: 500 }
    );
  }
  const transcript = transcriptResult.value.trim();
  if (!transcript) {
    return NextResponse.json({ ok: true, transcript: "", translations: { en: "", hi: "", ta: "" } });
  }

  const src = sourceLang.trim() || "en";
  const translations: Record<string, string> = {};
  for (const lang of CAPTION_LANGS) {
    if (lang === src) {
      translations[lang] = transcript;
      continue;
    }
    const r = await translateText(transcript, src, lang, geminiKey);
    translations[lang] = r.isOk() ? r.value : transcript;
  }
  return NextResponse.json({
    ok: true,
    transcript,
    translations: translations as { en: string; hi: string; ta: string },
  });
}
