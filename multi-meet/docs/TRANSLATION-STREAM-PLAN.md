# Translation in the room: plan and stream pub-sub

## What you have today

- **Pipeline:** `runTranslationPipeline(audio, sourceLang, targetLangs)` → ElevenLabs STT → Gemini translate → ElevenLabs TTS → `{ targetLang, text, audio }[]`.
- **API:** `POST /api/translation/process` (audio base64, sourceLang, targetLangs) → runs pipeline, returns translated text + base64 audio. Used by `/test-translation` (record → send chunks → display results).
- **Room:** Remote participants **publish** microphone **tracks**. Transcriber agent **subscribes** to those tracks, runs STT, **publishes text** on topic `lk.transcription`. UI **subscribes** to `lk.translation` and shows transcript.

## Goal

From **remote participant’s published audio**, run **STT → LLM translate (e.g. en→hi) → TTS** and **push the Hindi audio** so others can hear it in the same room. All in a **stream pub-sub** style.

---

## Stream pub-sub in LiveKit (two kinds)

| Kind | Pub | Sub | Used for |
|------|-----|-----|----------|
| **Text / data** | Publish to a **topic** (e.g. `lk.transcription`) | Register handler for that topic | Transcript lines, chat |
| **Media** | **Publish an audio/video track** to the room | **Subscribe to that track** and play it | Mic, camera, and **translated audio** |

For **translated Hindi audio**, the right model is **media pub-sub**: someone **publishes an audio track** (the Hindi output), and clients **subscribe** to that track and play it. So the “stream” is a **LiveKit audio track**, not a custom data topic.

---

## End-to-end flow (recommended: agent in the room)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  REMOTE PARTICIPANT (e.g. Alice)                                            │
│  • Publishes: microphone audio track (LiveKit media pub)                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        │ subscribe (agent receives audio)
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  TRANSLATION AGENT (in the same room)                                        │
│  1. Subscribes to each remote participant’s audio (or chosen ones).          │
│  2. Buffers / segments that audio (e.g. by silence or fixed interval).      │
│  3. For each segment:                                                        │
│     • STT (ElevenLabs) → text                                                │
│     • Gemini translate (e.g. en → hi) → Hindi text                           │
│     • TTS (ElevenLabs, Hindi) → Hindi audio buffer                           │
│  4. Publishes: Hindi audio as a new audio track in the room (media pub).     │
│     • e.g. track name "translated-hindi" or participant "Translator (Hindi)"│
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        │ publish new track
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  ROOM (LiveKit)                                                              │
│  • Tracks: [Alice-mic, Translator-Hindi-mic, ...]                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        │ subscribe (default or explicit)
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  OTHER PARTICIPANTS (e.g. Bob)                                               │
│  • Subscribe to the “Hindi” track (normal LiveKit track subscription).       │
│  • RoomAudioRenderer / playback plays it → they hear translated Hindi.       │
└─────────────────────────────────────────────────────────────────────────────┘
```

So:

- **Pub (translation):** Agent **publishes an audio track** (Hindi) into the room.
- **Sub (translation):** Clients **subscribe to that track** and play it (same as any other participant’s mic).

---

## Method options

### A) Translation agent (recommended for real-time in-room)

- **Where:** New LiveKit agent (e.g. `translator`), same idea as transcriber: dispatched to the room via token (or one agent that does both).
- **Input:** Subscribes to remote participants’ **audio tracks** (same as transcriber).
- **Processing:** For each segment of audio (e.g. when you have ~2–5 s or a sentence):
  - Get audio buffer from the track (or from the same pipeline the transcriber uses).
  - Run **STT → Gemini (en→hi) → TTS** (reuse `runTranslationPipeline` or call `/api/translation/process` from the agent with that buffer as base64).
- **Output:** **Publish an audio track** to the room (e.g. “Alice (Hindi)” or a single “Hindi” track). LiveKit SDK (e.g. `@livekit/rtc-node`) lets the agent publish a local audio track; you push the TTS output (decoded from MP3) into that track.
- **Sub:** Browsers already subscribe to room tracks; you ensure the “Hindi” track is played (e.g. show a second participant “Translator (Hindi)” or mix it in). No change to “stream” API — it’s normal **track pub-sub**.

**Pros:** Single place for STT/translate/TTS; low latency (no browser round-trip); uses your existing pipeline. **Cons:** Need to run an agent and implement segmenting + track publish.

### B) Browser → API → publish (alternative)

- **Input:** Browser captures the **remote participant’s audio** from the LiveKit track (e.g. from `RemoteTrack`), encodes chunks (e.g. WebM/base64).
- **Processing:** POST each chunk to `/api/translation/process`; get back Hindi audio (base64).
- **Output:** Browser either (1) plays that audio locally only, or (2) publishes it as a new **audio track** to the room (e.g. via `LocalAudioTrack` from a stream created from the decoded Hindi audio). Others **subscribe** to that track as in A.
- **Sub:** Same as A — subscribe to the track that carries the Hindi.

**Pros:** Reuses your API and test page logic. **Cons:** Higher latency (round-trip to your server), more logic in the client, and you must capture + encode remote audio and (if publishing) decode + push to a track.

---

## Recommended plan (A: agent)

1. **Translation agent (new worker, e.g. `translator`)**  
   - Dispatched to the room like the transcriber (token includes `RoomAgentDispatch` for `translator`).
   - Subscribes to remote participants’ audio (e.g. `AutoSubscribe.AUDIO_ONLY` and then, per participant, get their audio track).
   - Segments audio (time-based or using existing transcript segments if you couple with transcriber).
   - For each segment: run **STT → Gemini (en→hi) → TTS** (call `runTranslationPipeline(segmentBuffer, "en", ["hi"], env)` or the same steps in-process).
   - **Publish** the Hindi audio as a **new audio track** in the room (e.g. `LocalAudioTrack` from `@livekit/rtc-node`, fed with decoded TTS output). Optionally name the track or participant “Hindi” / “Translator (Hindi)” so the UI can show it clearly.

2. **Room UI**  
   - Keep using `RoomAudioRenderer` (or equivalent) so all published tracks (including the new Hindi track) are **subscribed** and played. Optionally list “Translated (Hindi)” as a separate participant or track so users know what they’re hearing.

3. **Existing routes**  
   - **`/api/translation/process`:** Keep for batch/test and for the test-translation page. The agent can either call this HTTP API with segment audio (base64) or call `runTranslationPipeline` directly in the agent process to avoid an extra hop.
   - **`/test-translation`:** Unchanged; still sends recorded chunks to the API and displays results. Good for testing pipeline and languages.

---

## Summary: how it works in the stream pub-sub model

- **Remote participant:** **Publishes** their mic **audio track** (existing).
- **Translation agent:** **Subscribes** to that track (input), runs **STT → LLM (Gemini) → TTS**, then **publishes** a new **audio track** (Hindi) into the room.
- **Other participants:** **Subscribe** to the Hindi track (same as any other track) and hear the translated audio.

So the “stream” for translated speech is **LiveKit’s normal media track pub-sub**: one participant (the agent) **publishes** an audio track; others **subscribe** to it. No separate message broker — the room is the pub-sub layer.
