import { transcribeAudio } from "@/lib/deepgram"
import { sendTranslationData } from "@/lib/livekit"
import type { ProcessTranslationRequest } from "@/types/pipeline"
import { NextResponse } from "next/server"

const PLACEHOLDER = "(transcription will appear when pipeline is connected)"
const PLACEHOLDERS = {
  en: PLACEHOLDER,
  ta: "(பைப்லைன் இணைக்கப்படும் வரை படியெடுப்பு தோன்றும்)",
  hi: "(पाइपलाइन कनेक्ट होने तक ट्रांसक्रिप्शन दिखेगा)",
  kn: "(ಪೈಪ್‌ಲೈನ್ ಸಂಪರ್ಕವಾಗುವವರೆಗೆ ಲಿಪ್ಯಂತರಣ ಕಾಣಿಸಿಕೊಳ್ಳುತ್ತದೆ)",
} as const

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as ProcessTranslationRequest | null
  if (!body?.roomId || !body?.speakerId || !body?.speakerLanguage || !Array.isArray(body.targetParticipants)) {
    return NextResponse.json(
      { ok: false, error: "roomId, speakerId, speakerLanguage and targetParticipants required" },
      { status: 400 }
    )
  }

  let transcription = PLACEHOLDER
  const translations: Record<string, string> = { ...PLACEHOLDERS }

  if (body.audioBase64) {
    const contentType = body.audioMimeType === "audio/ogg" ? "audio/ogg" : "audio/webm"
    const buffer = Buffer.from(body.audioBase64, "base64")
    const transcriptResult = await transcribeAudio(buffer, contentType, body.speakerLanguage)
    if (transcriptResult.isErr()) {
      console.warn("[translation/process] Deepgram error:", transcriptResult.error.message)
    } else if (transcriptResult.value.trim()) {
      transcription = transcriptResult.value.trim()
      translations.en = transcription
      translations.ta = transcription
      translations.hi = transcription
      translations.kn = transcription
      console.log("[translation/process] Transcript:", transcription)
    }
  }

  const sendResult = await sendTranslationData(body.roomId, {
    type: "translation",
    speakerId: body.speakerId,
    speakerName: body.speakerId,
    transcription,
    translations,
  })

  if (sendResult.isErr()) {
    return NextResponse.json(
      { ok: false, error: sendResult.error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, transcription })
}
