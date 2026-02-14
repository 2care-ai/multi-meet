import { err, ok, type Result } from "neverthrow";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const MODEL_ID = "gemini-3-flash";

export async function translateText(
  text: string,
  sourceLang: string,
  targetLang: string,
  apiKey: string
): Promise<Result<string, Error>> {
  const userContent = typeof text === "string" ? text : String(text ?? "");
  if (!userContent.trim()) {
    return err(new Error("Cannot translate empty text"));
  }

  const url = `${GEMINI_BASE}/${MODEL_ID}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: `You are a translator. Translate the user's message from ${sourceLang} into ${targetLang}. Reply with only the translation, no other text.` }],
      },
      contents: [{ parts: [{ text: userContent }] }],
      generationConfig: {
        maxOutputTokens: 1024,
        temperature: 0.2,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    return err(new Error(`Gemini translate failed: ${res.status} ${body}`));
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const textPart = data.candidates?.[0]?.content?.parts?.[0]?.text;
  const translated = typeof textPart === "string" ? textPart.trim() : "";
  if (!translated) return err(new Error("Gemini returned empty translation"));
  return ok(translated);
}
