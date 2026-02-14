# Multi-Meet — Audio-Only LiveKit Rooms

User-only (no agent) audio rooms: create a room, share the link, others join and talk. Your speech is shown as live transcript in the browser.

---

## What’s Implemented

### 1. **Room creation and join (LiveKit)**
- **Landing page (`/`)**: Enter your name → “Create room” creates a LiveKit room via the [Room Service API](https://docs.livekit.io/intro/basics/rooms-participants-tracks/rooms/) and redirects you to `/room/[roomName]`. Optional “Join a room” section: enter room name + your name → get a token and go to that room.
- **Room page (`/room/[roomName]`)**: If you have no token (e.g. opened the shared link), you see “Enter your name” and “Join”. After joining, you’re in the LiveKit room (audio only, no video).
- **In the room**: Participant list, mic mute/unmute, “Leave” to go home. All participants hear each other via LiveKit.

### 2. **Token storage (Redis / Upstash)**
- On create or join, the server issues a LiveKit access token and **stores it in Upstash Redis** (key: `lk_token:{roomName}:{identity}`, TTL 1 hour).
- The client still receives the token in the API response and keeps it in `sessionStorage` for the current tab. Redis is used for server-side persistence (e.g. future rejoin-by-code or server checks).

### 3. **Transcription (LiveKit native + transcriber agent)**
- Transcriptions are **not** done in the Next.js app. A **transcription agent** (in this repo under `transcriber/`) joins the room when a participant connects: participant tokens include **RoomAgentDispatch** so LiveKit dispatches the `transcriber` agent to the room. The agent runs STT only (no LLM, no TTS), publishes to **`lk.transcription`**, and the frontend **consumes** them.
- The room UI uses **`useTranscriptions()`** ([React hook](https://docs.livekit.io/reference/components/react/hook/usetranscriptions/)) to read from the **`lk.transcription`** text stream. It also subscribes to **`RoomEvent.TranscriptionReceived`** and logs each segment: `[room/ROOMNAME] Name: text`.
- **Run the transcriber** so transcriptions appear: from the app folder (`multi-meet/`), run `bun run transcriber:download-files` once, then `bun run transcriber:dev`. It uses the same `.env` as the app. Without the transcriber process running, the transcript area shows: *“Transcriptions appear when a transcription agent is in the room.”*
- The **creator** is the first local participant: they enter their name on the landing page before “Create room”; that name is on the LiveKit token and in the participant list (and in transcript lines when the agent sends participant identity/name).

### 4. **Speaking state logs (LiveKit)**
- **LiveKit** exposes **voice activity** per participant: the server does VAD and sets `participant.isSpeaking`.
- The app subscribes to **`ParticipantEvent.IsSpeakingChanged`** on the local participant and all remote participants (and on **`RoomEvent.ParticipantConnected`** for new joiners).
- When someone starts or stops speaking, the console logs: **`[room/ROOMNAME] DisplayName is speaking`** or **`DisplayName stopped speaking`**.

---

## Tech Stack

- **App**: Next.js 16 (App Router), React 19, Tailwind.
- **LiveKit**: `livekit-server-sdk` (create room + token), `@livekit/components-react` + `livekit-client` (room UI, audio only).
- **Redis**: `@upstash/redis` (REST) for token storage.
- **Conventions**: neverthrow for server results; no raw SQL.

---

## Env Vars (in `multi-meet/.env`)

Required for rooms and Redis:

| Variable | Purpose |
|----------|--------|
| `LIVEKIT_URL` | LiveKit server URL for **server** SDK (e.g. `wss://xxx.livekit.cloud`) |
| `LIVEKIT_API_KEY` | LiveKit API key |
| `LIVEKIT_API_SECRET` | LiveKit API secret |
| `NEXT_PUBLIC_LIVEKIT_URL` | Same LiveKit URL for **browser** (must match server) |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL (e.g. `https://xxx.upstash.io`) |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token |

If `UPSTASH_REDIS_REST_*` is missing, create/join still work; tokens just aren’t stored in Redis.

### Transcriber agent

Uses the same `.env` as the app (same LiveKit credentials). With **LiveKit Cloud**, STT uses LiveKit Inference (Deepgram Nova-3); no extra keys. For self-hosted or your own Deepgram, you may need a Deepgram plugin and `DEEPGRAM_API_KEY`.

### Translation agent (Hindi TTS)

The **translator** agent subscribes to the room’s **`lk.transcription`** stream, translates each final segment (e.g. en→hi) with **Gemini**, synthesizes Hindi speech with **ElevenLabs TTS**, and **publishes** a live audio track in the room. Participants hear the translated Hindi via **RoomAudioRenderer** (same as other mics). Requires in `.env`:

| Variable | Purpose |
|----------|--------|
| `ELEVEN_API_KEY` | ElevenLabs API key (STT/TTS for translation pipeline and translator) |
| `GEMINI_API_KEY` | Gemini API key (translation) |

Run with: `bun run translator:dev` from `multi-meet/`. Both **transcriber** and **translator** must be running for live transcript + Hindi output.

---

## How LiveKit transcription works

1. **Dispatch**: When a participant joins, their token includes **RoomAgentDispatch** for the `transcriber` agent. LiveKit assigns an idle transcriber worker to that room.
2. **Publisher**: The **transcriber agent** (STT only, no TTS/LLM) subscribes to participant audio, runs STT (e.g. Deepgram via LiveKit Inference), and **publishes** transcriptions on **`lk.transcription`**; the **sender identity** is the participant who was transcribed.
3. **Subscriber**: The frontend uses **`useTranscriptions()`** to **receive** those transcriptions and show them in the UI.

---

## How to Run

**App (required):**

```bash
cd multi-meet
bun install
bun run dev
```

Open **http://localhost:3000**.

**Transcriber (required for live transcript in the UI):**

From the same `multi-meet/` folder (after `bun install`):

```bash
bun run transcriber:download-files
bun run transcriber:dev
```

Keep the transcriber process running; it will join rooms when participants connect (dispatched via the token).

**Translator (optional, for Hindi TTS in the room):**

From the same `multi-meet/` folder, with `ELEVEN_API_KEY` and `GEMINI_API_KEY` set:

```bash
bun run translator:dev
```

Participants will hear the translated Hindi on the same room audio (one extra track). Run transcriber + translator together for transcript + Hindi.

---

## How to Test

### Create and join (two participants)

1. **Tab 1 (host)**  
   - Go to http://localhost:3000.  
   - Enter a name (e.g. “Alice”), click **Create room**.  
   - You’re redirected to `/room/XXXXXXXXXX`.  
   - Copy the **full URL** from the address bar (e.g. `http://localhost:3000/room/C2FZAEYX0L`).

2. **Tab 2 (guest)**  
   - Open the copied URL in a new tab (or another browser/device on the same network).  
   - You see “Join room: …” and a name field.  
   - Enter a name (e.g. “Bob”), click **Join**.  
   - You enter the same room.

3. **In both tabs**  
   - You should see each other in the participant list.  
   - Unmute (mic on) and speak; both should hear each other.  
   - Use **Leave** or close the tab to exit.

### Transcriptions and logs

1. **Without the transcriber**: If the `transcriber` worker is not running, the room shows *“Transcriptions appear when a transcription agent is in the room.”* Speaking logs still work: open the **browser console** (F12) and you’ll see **`Name is speaking`** / **`Name stopped speaking`** when anyone talks.  
2. **With the transcriber**: Run the transcriber (`bun run transcriber:dev` from `multi-meet/`). Create or join a room; the transcriber is dispatched when you connect. The **“Transcript (LiveKit)”** section will show **`Name: text`** and the console will log **`[room/ROOMNAME] Name: text`** for each segment.

### Redis (optional)

- With `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` set, create or join a room once.  
- In the Upstash dashboard, open the Redis browser and check for keys like `lk_token:XXXXXXXXXX:Name-xxxxxx`; they expire after 1 hour.

---

## Main Files

| Path | Role |
|------|------|
| `app/page.tsx` | Landing: name, Create room, Join room form |
| `app/room/[roomName]/page.tsx` | Room page wrapper |
| `components/audio-room.tsx` | Join form or LiveKit room UI + useTranscriptions + speaking logs |
| `app/api/room/create/route.ts` | POST create room, issue token, store in Redis |
| `app/api/room/join/route.ts` | POST issue token for room, store in Redis |
| `lib/livekit.ts` | createRoom, createToken (with RoomAgentDispatch for transcriber) |
| `lib/redis.ts` | setToken, getToken (Upstash Redis REST) |
| `transcriber/main.ts` | Transcriber agent (STT only); dispatched to rooms via token |
