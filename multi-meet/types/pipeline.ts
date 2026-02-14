export type ProcessTranslationRequest = {
  roomId: string
  speakerId: string
  speakerLanguage: string
  audioBase64?: string
  audioMimeType?: "audio/webm" | "audio/ogg"
  targetParticipants: Array<{ id: string; language: string }>
}

export type ProcessTranslationResponse =
  | { ok: true; transcription?: string; translations?: Record<string, string> }
  | { ok: false; error: string }
