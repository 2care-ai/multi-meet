export const LANGUAGES = ["en", "ta", "hi", "kn"] as const
export type Language = (typeof LANGUAGES)[number]

export type TranslationRoomMessage = {
  type: "translation"
  speakerId: string
  speakerName?: string
  transcription: string
  translations: Record<string, string>
}

export type Room = {
  id: string
  createdAt: string
}

export type UserConfig = {
  userId: string
  language: string
  voiceId?: string
  roomId: string
  createdAt: string
  updatedAt: string
}