import { createClient } from "@deepgram/sdk";
import Groq from "groq-sdk";
import { ElevenLabsClient } from "elevenlabs";
import { err, ok } from "neverthrow";
import type { TargetParticipant, TranslatedAudioResult } from "@/types/pipeline";

const DEEPGRAM_KEY = process.env.DEEPGRAM_API_KEY ?? "";
const ELEVENLABS_KEY = process.env.ELEVENLABS_API_KEY ?? "";
const DEFAULT_VOICE_ID = process.env.ELEVENLABS_DEFAULT_VOICE_ID ?? "21m00Tcm4TlvDq8ikWAM";
const TTS_MODEL = "eleven_turbo_v2";

const LANGUAGE_TO_VOICE: Record<string, string> = {
  en: DEFAULT_VOICE_ID,
  hi: DEFAULT_VOICE_ID,
  ta: DEFAULT_VOICE_ID,
  es: DEFAULT_VOICE_ID,
};

function getVoiceForLanguage(lang: string): string {
  return LANGUAGE_TO_VOICE[lang] ?? DEFAULT_VOICE_ID;
}

function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

export async function speechToText(
  audioBuffer: Buffer,
  language: string
): Promise<import("neverthrow").Result<string, string>> {
  if (!DEEPGRAM_KEY) return err("DEEPGRAM_API_KEY missing");
  try {
    const deepgram = createClient(DEEPGRAM_KEY);
    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      audioBuffer,
      { model: "nova-2", language, smart_format: true }
    );
    if (error) return err(error.message ?? "Deepgram error");
    const transcript =
      result?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";
    if (!transcript.trim()) return err("Empty transcript");
    return ok(transcript);
  } catch (e) {
    return err(e instanceof Error ? e.message : "STT failed");
  }
}

const GROQ_KEY = process.env.GROQ_API_KEY ?? "";
const GROQ_MODEL = process.env.GROQ_TRANSLATION_MODEL ?? "llama-3.1-8b-instant";

export async function translateText(
  text: string,
  fromLang: string,
  toLang: string
): Promise<import("neverthrow").Result<string, string>> {
  if (fromLang === toLang) return ok(text);
  if (!GROQ_KEY) return err("GROQ_API_KEY missing");
  try {
    const groq = new Groq({ apiKey: GROQ_KEY });
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        {
          role: "system",
          content: `You are a translator. Translate the user's message from language code "${fromLang}" to language code "${toLang}". Reply with only the translated text, no explanation or quotes.`,
        },
        { role: "user", content: text },
      ],
      max_tokens: 1024,
    });
    const out = completion.choices[0]?.message?.content?.trim() ?? "";
    return ok(out || text);
  } catch (e) {
    return err(e instanceof Error ? e.message : "Translation failed");
  }
}

export async function textToSpeech(
  text: string,
  language: string
): Promise<import("neverthrow").Result<ArrayBuffer, string>> {
  if (!ELEVENLABS_KEY) return err("ELEVENLABS_API_KEY missing");
  try {
    const client = new ElevenLabsClient({ apiKey: ELEVENLABS_KEY });
    const voiceId = getVoiceForLanguage(language);
    const stream = await client.textToSpeech.convert(voiceId, {
      text,
      model_id: TTS_MODEL,
      language_code: language,
    });
    const buffer = await streamToBuffer(stream);
    const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
    return ok(ab);
  } catch (e) {
    return err(e instanceof Error ? e.message : "TTS failed");
  }
}

export async function processParticipantAudio(
  audioBuffer: Buffer,
  speakerLanguage: string,
  targetParticipants: TargetParticipant[]
): Promise<import("neverthrow").Result<TranslatedAudioResult[], string>> {
  const sttResult = await speechToText(audioBuffer, speakerLanguage);
  if (sttResult.isErr()) return err(sttResult.error);
  const transcript = sttResult.value;

  const results: TranslatedAudioResult[] = [];
  for (const target of targetParticipants) {
    if (target.language === speakerLanguage) continue;
    const transResult = await translateText(transcript, speakerLanguage, target.language);
    const text = transResult.isErr() ? transcript : transResult.value;
    const ttsResult = await textToSpeech(text, target.language);
    if (ttsResult.isErr()) continue;
    results.push({
      participantId: target.id,
      language: target.language,
      audioBuffer: ttsResult.value,
    });
  }

  return ok(results);
}
