import { NextResponse } from "next/server";
import type { ProcessTranslationRequest, ProcessTranslationResponse } from "@/types/pipeline";
import { runTranslationPipeline } from "@/lib/translation-pipeline";

export async function POST(request: Request) {
  let body: ProcessTranslationRequest;
  try {
    body = (await request.json()) as ProcessTranslationRequest;
  } catch {
    return NextResponse.json<ProcessTranslationResponse>(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { audioBase64, sourceLang, targetLangs } = body;
  if (
    !audioBase64 ||
    typeof sourceLang !== "string" ||
    !sourceLang.trim() ||
    !Array.isArray(targetLangs) ||
    targetLangs.length === 0
  ) {
    return NextResponse.json<ProcessTranslationResponse>(
      { ok: false, error: "audioBase64, sourceLang, and non-empty targetLangs are required" },
      { status: 400 }
    );
  }
  const validTargets = targetLangs.filter(
    (t): t is string => typeof t === "string" && t.trim().length > 0
  );
  if (validTargets.length === 0) {
    return NextResponse.json<ProcessTranslationResponse>(
      { ok: false, error: "At least one valid target language is required" },
      { status: 400 }
    );
  }

  let audio: Buffer;
  try {
    audio = Buffer.from(audioBase64, "base64");
  } catch {
    return NextResponse.json<ProcessTranslationResponse>(
      { ok: false, error: "Invalid base64 audio" },
      { status: 400 }
    );
  }

  const result = await runTranslationPipeline(
    audio,
    sourceLang.trim(),
    validTargets.map((t) => t.trim()),
    {
      ELEVEN_API_KEY: process.env.ELEVEN_API_KEY ?? "",
      GEMINI_API_KEY: process.env.GEMINI_API_KEY ?? "",
    }
  );

  if (result.isOk()) {
    const results = result.value.map((r) => ({
      targetLang: r.targetLang,
      translatedText: r.text,
      audioBase64: r.audio.toString("base64"),
    }));
    return NextResponse.json<ProcessTranslationResponse>({ ok: true, results });
  }
  return NextResponse.json<ProcessTranslationResponse>(
    { ok: false, error: result.error.message },
    { status: 500 }
  );
}
