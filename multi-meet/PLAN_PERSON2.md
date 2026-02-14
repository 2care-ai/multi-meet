# Person 2 Plan – Pipeline & Audio

Use **Bun** for install and scripts: `bun add ...`, `bun run dev`, `bun run build`.

## Your scope

**You own** (only you edit these):

- `types/pipeline.ts`
- `lib/translation-pipeline.ts`
- `lib/stream-processor.ts`
- `lib/audio-publisher.ts`
- `app/api/translation/` (e.g. `process/route.ts`)

**You may read (do not edit):** `types/translation.ts`, `db/` (for participant/language data if needed).

**You do not touch:** `db/`, `lib/livekit.ts`, room API, setup/room pages, `TranslationRoom`, or other components.

---

## Contract you implement

- **Route:** `POST /api/translation/process`
- **Request body:** `ProcessTranslationRequest` (you define this in `types/pipeline.ts`)
- **Response:** `{ ok: true }` or `{ ok: false, error: string }`

Person 1's UI will call this route with that request shape; you implement the handler and everything behind it.

---

## Week 1 – Contract and pipeline core

| Task | File | What to do |
|------|------|------------|
| 1 | `types/pipeline.ts` | Add `ProcessTranslationRequest` (roomId, speakerId, speakerLanguage, audioBase64?, targetParticipants: `{ id, language }[]`), `ProcessTranslationResponse` (`{ ok, error? }`), and any internal pipeline types. |
| 2 | `lib/translation-pipeline.ts` | Implement pipeline: **input** = speaker audio (buffer/stream), speaker language, list of target participants (id + language). **Steps:** STT (Deepgram) → text; for each target with language ≠ speaker: translate (Groq) → TTS (ElevenLabs); same language = passthrough. **Output** = translated audio per target. Use **neverthrow** for all I/O. |

---

## Week 2 – External integrations and stream processor

| Task | File | What to do |
|------|------|------------|
| 3 | `lib/translation-pipeline.ts` | Wire **Deepgram** (streaming STT), **Groq** (translation), **ElevenLabs** (low-latency model). |
| 4 | `lib/stream-processor.ts` | Buffer incoming audio **per participant** (e.g. 2s windows). When buffer ready, call pipeline. You may read from `db` (read-only) for room/participant list if needed. |

---

## Week 3 – Audio out and API route

| Task | File | What to do |
|------|------|------------|
| 5 | `lib/audio-publisher.ts` | **Input:** translated audio buffer + target participant id. Publish to LiveKit so only that participant receives it. Use server SDK only; do not edit `lib/livekit.ts`. |
| 6 | `app/api/translation/process/route.ts` | **POST** handler: parse `ProcessTranslationRequest`, push audio into stream processor → pipeline → audio-publisher, return `ProcessTranslationResponse`. Use **neverthrow**. |

---

## Integration (with Person 1)

- Agree on exact request shape (especially `audioBase64` or format).
- Run E2E: two browsers, different languages, verify translated audio.

---

## Phase 4 (Week 5) – Your part

- Latency: streaming STT, chunked translation, low-latency TTS, connection pooling.
- Edge cases: same-language passthrough, overlapping-speech queue, errors and retries (neverthrow).
