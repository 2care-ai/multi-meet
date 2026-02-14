export type ProcessTranslationRequest = {
  audioBase64: string;
  sourceLang: string;
  targetLangs: string[];
};

export type ProcessTranslationResponse =
  | { ok: true; results: { targetLang: string; translatedText: string; audioBase64: string }[] }
  | { ok: false; error: string };
