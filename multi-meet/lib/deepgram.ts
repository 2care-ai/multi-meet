import { ResultAsync } from "neverthrow"

const DEEPGRAM_URL = "https://api.deepgram.com/v1/listen"

function getTranscriptFromResponse(data: unknown): string {
  if (!data || typeof data !== "object") return ""
  const r = data as Record<string, unknown>
  const results = r.results as Record<string, unknown> | undefined
  if (results?.channels && Array.isArray(results.channels)) {
    const first = results.channels[0] as Record<string, unknown> | undefined
    const alts = first?.alternatives as Array<{ transcript?: string }> | undefined
    const t = alts?.[0]?.transcript
    if (typeof t === "string") return t.trim()
  }
  if (results?.channel && typeof results.channel === "object") {
    const ch = results.channel as Record<string, unknown>
    const alts = ch.alternatives as Array<{ transcript?: string }> | undefined
    const t = alts?.[0]?.transcript
    if (typeof t === "string") return t.trim()
  }
  const channel = r.channel as Record<string, unknown> | undefined
  if (channel?.alternatives && Array.isArray(channel.alternatives)) {
    const t = (channel.alternatives[0] as { transcript?: string })?.transcript
    if (typeof t === "string") return t.trim()
  }
  return ""
}

export function transcribeAudio(
  audioBuffer: Buffer,
  contentType: "audio/webm" | "audio/ogg",
  language: string
): ResultAsync<string, Error> {
  const apiKey = process.env.DEEPGRAM_API_KEY
  if (!apiKey) {
    console.warn("[deepgram] DEEPGRAM_API_KEY is not set - add it to .env for live transcription")
    return ResultAsync.fromPromise(
      Promise.reject(new Error("DEEPGRAM_API_KEY not set")),
      (e) => (e instanceof Error ? e : new Error(String(e)))
    )
  }
  const langParam = ["en", "ta", "hi", "kn"].includes(language) ? language : "en"
  const url = `${DEEPGRAM_URL}?model=nova-3&smart_format=true&language=${langParam}`
  return ResultAsync.fromPromise(
    (async () => {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Token ${apiKey}`,
          "Content-Type": contentType,
        },
        body: new Uint8Array(audioBuffer),
      })
      if (!res.ok) {
        const err = await res.text()
        throw new Error(`Deepgram: ${res.status} ${err}`)
      }
      const data = (await res.json()) as unknown
      const transcript = getTranscriptFromResponse(data)
      if (!transcript && typeof data === "object" && data !== null) {
        console.warn("[deepgram] Empty transcript. Response keys:", Object.keys(data as object))
      }
      return transcript
    })(),
    (e) => (e instanceof Error ? e : new Error(String(e)))
  )
}
