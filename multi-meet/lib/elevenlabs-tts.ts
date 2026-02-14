import { err, ok, type Result } from "neverthrow";

const ELEVEN_TTS_URL = "https://api.elevenlabs.io/v1/text-to-speech";
const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";
const MODEL_ID = "eleven_multilingual_v2";

export async function synthesizeSpeech(
  text: string,
  apiKey: string
): Promise<Result<Buffer, Error>> {
  const trimmed = text.trim();
  if (!trimmed) return err(new Error("Cannot synthesize empty text"));

  const voice = (process.env.ELEVEN_VOICE_ID ?? DEFAULT_VOICE_ID).trim();
  const url = `${ELEVEN_TTS_URL}/${voice}?output_format=mp3_44100_128`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: trimmed, model_id: MODEL_ID }),
  });

  if (!res.ok) {
    const body = await res.text();
    return err(new Error(`ElevenLabs TTS failed: ${res.status} ${body}`));
  }

  const arrayBuffer = await res.arrayBuffer();
  return ok(Buffer.from(arrayBuffer));
}

const PCM_24K_SAMPLE_RATE = 24_000;
const PCM_24K_CHANNELS = 1;

export async function synthesizeSpeechPcm(
  text: string,
  apiKey: string
): Promise<Result<{ pcm: Buffer; sampleRate: number; numChannels: number }, Error>> {
  const trimmed = text.trim();
  if (!trimmed) return err(new Error("Cannot synthesize empty text"));

  const voice = (process.env.ELEVEN_VOICE_ID ?? DEFAULT_VOICE_ID).trim();
  const url = `${ELEVEN_TTS_URL}/${voice}?output_format=pcm_24000`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: trimmed, model_id: MODEL_ID }),
  });

  if (!res.ok) {
    const body = await res.text();
    return err(new Error(`ElevenLabs TTS failed: ${res.status} ${body}`));
  }

  const arrayBuffer = await res.arrayBuffer();
  return ok({
    pcm: Buffer.from(arrayBuffer),
    sampleRate: PCM_24K_SAMPLE_RATE,
    numChannels: PCM_24K_CHANNELS,
  });
}
