import { err, ok, type Result } from "neverthrow";

const ELEVEN_API_URL = "https://api.elevenlabs.io/v1/speech-to-text";
const MODEL_ID = "scribe_v2";

export async function transcribeAudio(
  audioBuffer: Buffer,
  apiKey: string,
  languageCode?: string
): Promise<Result<string, Error>> {
  const formData = new FormData();
  formData.set("model_id", MODEL_ID);
  if (languageCode?.trim()) formData.set("language_code", languageCode.trim());
  formData.set(
    "file",
    new Blob([new Uint8Array(audioBuffer)], { type: "audio/webm" }),
    "audio.webm"
  );

  const res = await fetch(ELEVEN_API_URL, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
    },
    body: formData,
  });

  if (!res.ok) {
    const body = await res.text();
    return err(new Error(`ElevenLabs STT failed: ${res.status} ${body}`));
  }

  const data = (await res.json()) as { text?: string; words?: { text: string }[] };
  const text = data.text ?? data.words?.map((w) => w.text).join(" ") ?? "";
  const trimmed = text.trim();
  return ok(trimmed);
}
