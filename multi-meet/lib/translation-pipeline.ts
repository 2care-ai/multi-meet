import { ResultAsync, err, okAsync } from "neverthrow";
import type { Result } from "neverthrow";
import { transcribeAudio } from "./elevenlabs-stt";
import { translateText } from "./gemini-translate";
import { synthesizeSpeech } from "./elevenlabs-tts";

export type PipelineOutputItem = { targetLang: string; text: string; audio: Buffer };
export type PipelineResult = Result<PipelineOutputItem[], Error>;

export function runTranslationPipeline(
  audio: Buffer,
  sourceLang: string,
  targetLangs: string[],
  env: {
    ELEVEN_API_KEY: string;
    GEMINI_API_KEY: string;
  }
): Promise<PipelineResult> {
  const { ELEVEN_API_KEY, GEMINI_API_KEY } = env;
  if (!ELEVEN_API_KEY || !GEMINI_API_KEY) {
    return Promise.resolve(err(new Error("Missing ELEVEN_API_KEY or GEMINI_API_KEY")));
  }
  if (!targetLangs.length) {
    return Promise.resolve(err(new Error("At least one target language is required")));
  }

  const transcriptPromise = transcribeAudio(
    audio,
    ELEVEN_API_KEY,
    sourceLang
  ).then((r) => {
    if (r.isErr()) throw r.error;
    return r.value;
  });
  const resultAsync = ResultAsync.fromSafePromise(transcriptPromise).andThen((transcript) => {
    if (!transcript.trim()) return okAsync([]);
    const runPipeline = async () => {
      const translatedList = await Promise.all(
        targetLangs.map(async (targetLang) => {
          const r = await translateText(
            transcript,
            sourceLang,
            targetLang,
            GEMINI_API_KEY
          );
          if (r.isErr()) throw r.error;
          return { targetLang, text: r.value };
        })
      );
      const results: { targetLang: string; text: string; audio: Buffer }[] = [];
      for (const { targetLang, text } of translatedList) {
        const tts = await synthesizeSpeech(text, ELEVEN_API_KEY);
        if (tts.isErr()) throw tts.error;
        results.push({ targetLang, text, audio: tts.value });
      }
      return results;
    };
    return ResultAsync.fromSafePromise(runPipeline());
  });
  return Promise.resolve(resultAsync);
}
