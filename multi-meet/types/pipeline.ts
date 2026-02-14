export type ProcessTranslationRequest = {
  roomId: string
  speakerId: string
  speakerLanguage: string
  audioBase64?: string
  targetParticipants: Array<{ id: string; language: string }>
}

export type ProcessTranslationResponse =
  | { ok: true }
  | { ok: false; error: string }

export type TargetParticipant = {
  id: string
  language: string
}

export type TranslatedAudioResult = {
  participantId: string
  language: string
  audioBuffer: ArrayBuffer
}
