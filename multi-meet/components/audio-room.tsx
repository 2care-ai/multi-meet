"use client";

import {
  LiveKitRoom,
  RoomAudioRenderer,
  useAudioWaveform,
  useIsSpeaking,
  useLocalParticipant,
  useParticipants,
  useRoomContext,
  useTextStream,
  useTrackToggle,
  useTranscriptions,
} from "@livekit/components-react";
import {
  type LocalAudioTrack,
  type Participant,
  ParticipantEvent,
  RoomEvent,
  Track,
} from "livekit-client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const TOKEN_KEY_PREFIX = "lk_token_";
const CREATOR_KEY_PREFIX = "lk_creator_";
const TRANSLATION_TOPIC = "lk.translation";

const LANG_LABELS: Record<string, string> = {
  hi: "Hindi",
  te: "Telugu",
  ta: "Tamil",
  mr: "Marathi",
  bn: "Bengali",
  kn: "Kannada",
  ml: "Malayalam",
  gu: "Gujarati",
};
function langLabel(code: string): string {
  return LANG_LABELS[code] ?? code;
}

const TRANSCRIPT_COLORS = [
  "text-emerald-600 dark:text-emerald-400",
  "text-sky-600 dark:text-sky-400",
  "text-amber-600 dark:text-amber-400",
  "text-violet-600 dark:text-violet-400",
  "text-rose-600 dark:text-rose-400",
] as const;

function getStoredToken(roomName: string): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(TOKEN_KEY_PREFIX + roomName);
}

function getStoredCreator(roomName: string): { identity: string; name: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CREATOR_KEY_PREFIX + roomName);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { identity?: string; name?: string };
    return parsed?.identity ? { identity: parsed.identity, name: parsed.name ?? parsed.identity } : null;
  } catch {
    return null;
  }
}

export function AudioRoom({ roomName }: { roomName: string }) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [joinName, setJoinName] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState("");

  useEffect(() => {
    setToken(getStoredToken(roomName));
  }, [roomName]);

  const handleJoin = useCallback(async () => {
    const name = joinName.trim();
    if (!name) {
      setJoinError("Enter your name");
      return;
    }
    setJoinError("");
    setJoinLoading(true);
    try {
      const res = await fetch("/api/room/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomName, name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setJoinError(data.error ?? "Failed to join");
        return;
      }
      sessionStorage.setItem(TOKEN_KEY_PREFIX + roomName, data.token);
      setToken(data.token);
    } catch {
      setJoinError("Something went wrong");
    } finally {
      setJoinLoading(false);
    }
  }, [roomName, joinName]);

  if (token === null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
        <div className="w-full max-w-sm space-y-4 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-lg font-medium text-zinc-800 dark:text-zinc-200">
            Join room: {roomName}
          </h2>
          <input
            type="text"
            placeholder="Your name"
            value={joinName}
            onChange={(e) => setJoinName(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-400"
          />
          {joinError && (
            <p className="text-sm text-red-600 dark:text-red-400">{joinError}</p>
          )}
          <button
            type="button"
            onClick={handleJoin}
            disabled={joinLoading}
            className="w-full rounded-lg bg-zinc-900 py-2.5 font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {joinLoading ? "Joining…" : "Join"}
          </button>
        </div>
      </div>
    );
  }

  const serverUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
  if (!serverUrl) {
    return (
      <div className="flex min-h-screen items-center justify-center text-red-600 dark:text-red-400">
        Missing NEXT_PUBLIC_LIVEKIT_URL
      </div>
    );
  }

  return (
    <LiveKitRoom
      serverUrl={serverUrl}
      token={token}
      connect={true}
      audio={true}
      video={false}
      onDisconnected={() => {
        sessionStorage.removeItem(TOKEN_KEY_PREFIX + roomName);
        sessionStorage.removeItem(CREATOR_KEY_PREFIX + roomName);
        router.push("/");
      }}
      className="flex min-h-screen flex-col bg-zinc-950"
    >
      <RoomAudioRenderer />
      <AudioRoomUI roomName={roomName} />
    </LiveKitRoom>
  );
}

function useTranscriptionLogs(roomName: string) {
  const room = useRoomContext();

  useEffect(() => {
    const handler = (segments: { text: string }[], participant?: Participant) => {
      const name = participant?.name ?? participant?.identity ?? "?";
      for (const seg of segments) {
        if (seg.text?.trim()) {
          console.log(`[room/${roomName}] ${name}: ${seg.text.trim()}`);
        }
      }
    };

    room.on(RoomEvent.TranscriptionReceived, handler);
    return () => {
      room.off(RoomEvent.TranscriptionReceived, handler);
    };
  }, [room, roomName]);
}

type TranscriptEntry = { identity: string; name: string; text: string };
type TranslationEntry = { identity: string; name: string; text: string; lang: string };

function useLegacyTranscriptions(): TranscriptEntry[] {
  const room = useRoomContext();
  const [entries, setEntries] = useState<TranscriptEntry[]>([]);

  useEffect(() => {
    const handler = (
      segments: { id: string; text: string; final?: boolean }[],
      participant?: Participant
    ) => {
      const identity = participant?.identity ?? "?";
      const name = participant?.name ?? participant?.identity ?? "?";
      setEntries((prev) => {
        const next = [...prev];
        for (const seg of segments) {
          if (seg.text?.trim()) {
            next.push({ identity, name, text: seg.text.trim() });
          }
        }
        return next;
      });
    };

    room.on(RoomEvent.TranscriptionReceived, handler);
    return () => {
      room.off(RoomEvent.TranscriptionReceived, handler);
    };
  }, [room]);

  return entries;
}

function useSpeakingLogs(roomName: string) {
  const room = useRoomContext();

  useEffect(() => {
    const logSpeaking = (participant: Participant, speaking: boolean) => {
      const label = participant.name ?? participant.identity;
      console.log(`[room/${roomName}] ${label} ${speaking ? "is speaking" : "stopped speaking"}`);
    };

    const bindSpeaking = (p: Participant) => {
      p.on(ParticipantEvent.IsSpeakingChanged, (speaking: boolean) => logSpeaking(p, speaking));
    };

    bindSpeaking(room.localParticipant);
    room.remoteParticipants.forEach((p) => bindSpeaking(p));

    const onParticipantConnected = (participant: Participant) => {
      bindSpeaking(participant);
    };

    room.on(RoomEvent.ParticipantConnected, onParticipantConnected);

    return () => {
      room.off(RoomEvent.ParticipantConnected, onParticipantConnected);
    };
  }, [room, roomName]);
}

function useParticipantColorMap(
  transcriptionIdentities: string[],
  creatorIdentity: string | null,
  localIdentity: string
): Map<string, string> {
  return useMemo(() => {
    const order: string[] = [];
    const seen = new Set<string>();
    if (creatorIdentity && !seen.has(creatorIdentity)) {
      order.push(creatorIdentity);
      seen.add(creatorIdentity);
    }
    if (!seen.has(localIdentity)) {
      order.push(localIdentity);
      seen.add(localIdentity);
    }
    for (const id of transcriptionIdentities) {
      if (!seen.has(id)) {
        order.push(id);
        seen.add(id);
      }
    }
    const map = new Map<string, string>();
    order.forEach((id, i) => map.set(id, TRANSCRIPT_COLORS[i % TRANSCRIPT_COLORS.length]));
    return map;
  }, [transcriptionIdentities, creatorIdentity, localIdentity]);
}

type MuteState = "muted" | "unmuted" | "pending";

function MicButtonWithWaveform() {
  const { localParticipant } = useLocalParticipant();
  const {
    enabled: micOn,
    pending,
    buttonProps,
  } = useTrackToggle({ source: Track.Source.Microphone });

  const muteState: MuteState = pending ? "pending" : micOn ? "unmuted" : "muted";

  const micPub = localParticipant.getTrackPublication(Track.Source.Microphone);
  const micTrack =
    micPub?.track?.kind === Track.Kind.Audio ? (micPub.track as LocalAudioTrack) : undefined;
  const { bars } = useAudioWaveform(micTrack, { barCount: 7, volMultiplier: 1.2 });
  const isSpeaking = useIsSpeaking(localParticipant);
  const showWave =
    muteState === "unmuted" && (isSpeaking || bars.some((b) => b > 0.05));

  const label =
    muteState === "muted"
      ? "Microphone muted — click to unmute"
      : muteState === "pending"
        ? "Updating microphone…"
        : "Microphone on — click to mute";

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        {...buttonProps}
        type="button"
        aria-label={label}
        aria-pressed={muteState === "unmuted"}
        disabled={pending}
        className={`
          relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full
          text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-950
          disabled:opacity-60 disabled:cursor-not-allowed
          ${muteState === "muted"
            ? "bg-red-600 hover:bg-red-500 focus:ring-red-500"
            : muteState === "pending"
              ? "bg-zinc-600 cursor-wait"
              : "bg-zinc-700 hover:bg-zinc-600 focus:ring-zinc-500"
          }
        `}
      >
        {pending ? (
          <span className="h-5 w-5 animate-pulse rounded-full bg-white/80" aria-hidden />
        ) : showWave ? (
          <span className="flex h-6 items-end justify-center gap-0.5" aria-hidden>
            {bars.map((h, i) => (
              <span
                key={i}
                className="w-0.5 min-h-[4px] rounded-full bg-white transition-all duration-75"
                style={{ height: `${Math.max(4, Math.min(24, h * 24))}px` }}
              />
            ))}
          </span>
        ) : (
          <MicIcon muted={muteState === "muted"} />
        )}
      </button>
      <span
        className="text-sm font-medium tabular-nums"
        aria-live="polite"
        data-state={muteState}
      >
        {muteState === "muted" && (
          <span className="text-red-400">Muted</span>
        )}
        {muteState === "unmuted" && (
          <span className="text-zinc-300">Unmuted</span>
        )}
        {muteState === "pending" && (
          <span className="text-zinc-500">Updating…</span>
        )}
      </span>
    </div>
  );
}

function MicIcon({ muted }: { muted: boolean }) {
  if (muted) {
    return (
      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
      </svg>
    );
  }
  return (
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
    </svg>
  );
}

function ParticipantTile({
  participant,
  isCreator,
  isSpeaking,
}: {
  participant: Participant;
  isCreator: boolean;
  isSpeaking: boolean;
}) {
  const name = participant.name ?? participant.identity;
  const isLocal = participant.isLocal;

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border-2 bg-zinc-900/80 px-4 py-3 transition-all ${
        isSpeaking ? "border-green-500/80 shadow-[0_0_20px_rgba(34,197,94,0.25)]" : "border-zinc-700/50"
      }`}
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
          isSpeaking ? "bg-green-500/20 text-green-400" : "bg-zinc-700 text-zinc-300"
        }`}
      >
        {name.slice(0, 2).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-zinc-100">{name}</p>
        <div className="flex flex-wrap gap-1.5">
          {isLocal && (
            <span className="rounded bg-zinc-600 px-1.5 py-0.5 text-xs text-zinc-200">You</span>
          )}
          {isCreator && (
            <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-xs text-amber-400">
              Creator
            </span>
          )}
          {isSpeaking && (
            <span className="rounded bg-green-500/20 px-1.5 py-0.5 text-xs text-green-400">
              Speaking
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function AudioRoomUI({ roomName }: { roomName: string }) {
  const router = useRouter();
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const transcriptions = useTranscriptions();
  const legacyTranscriptions = useLegacyTranscriptions();
  const { textStreams: translationStreams } = useTextStream(TRANSLATION_TOPIC);
  const creator = getStoredCreator(roomName);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useSpeakingLogs(roomName);
  useTranscriptionLogs(roomName);

  const participantNameByIdentity = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of participants) {
      m.set(p.identity, p.name ?? p.identity);
    }
    return m;
  }, [participants]);

  const streamEntries: TranscriptEntry[] = transcriptions.map((t) => {
    const pi = t.participantInfo as { identity: string; name?: string };
    return {
      identity: pi?.identity ?? "?",
      name: pi?.name ?? pi?.identity ?? "?",
      text: t.text ?? "",
    };
  });

  const displayEntries =
    streamEntries.length > 0 ? streamEntries : legacyTranscriptions;

  const translationEntries: TranslationEntry[] = useMemo(() => {
    return translationStreams
      .filter((t) => t.text?.trim())
      .map((t) => {
        const attrs = t.streamInfo?.attributes ?? {};
        const speakerIdentity = attrs["lk.translation_speaker"] ?? "?";
        const lang = attrs["lk.translation_lang"] ?? "";
        return {
          identity: speakerIdentity,
          name: participantNameByIdentity.get(speakerIdentity) ?? speakerIdentity,
          text: t.text ?? "",
          lang,
        };
      });
  }, [translationStreams, participantNameByIdentity]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayEntries.length, translationEntries.length]);

  const handleLeave = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY_PREFIX + roomName);
    sessionStorage.removeItem(CREATOR_KEY_PREFIX + roomName);
    router.push("/");
  }, [roomName, router]);

  const identityList = displayEntries.map((e) => e.identity);
  const identities = [...new Set(identityList)];
  const colorMap = useParticipantColorMap(
    identities,
    creator?.identity ?? null,
    localParticipant.identity
  );

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-900/80 px-4 py-3 backdrop-blur">
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="truncate text-xl font-semibold tracking-tight text-white">
            {roomName}
          </h1>
          <span className="shrink-0 rounded bg-zinc-700 px-2 py-0.5 text-xs text-zinc-300">
            Meeting
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-400">
            {participants.length} participant{participants.length !== 1 ? "s" : ""}
          </span>
          <button
            type="button"
            onClick={handleLeave}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-zinc-900"
          >
            Leave
          </button>
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-4 overflow-hidden p-4 md:flex-row">
        <section className="flex flex-col gap-3 overflow-hidden md:max-w-[280px]">
          <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Participants
          </h2>
          <ul className="flex flex-1 flex-col gap-2 overflow-auto">
            {participants.map((p) => (
              <li key={p.identity}>
                <ParticipantTile
                  participant={p}
                  isCreator={creator?.identity === p.identity}
                  isSpeaking={p.isSpeaking}
                />
              </li>
            ))}
          </ul>
        </section>

        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60">
          <div className="flex shrink-0 items-center gap-2 border-b border-zinc-800 px-4 py-2">
            <span className="text-sm font-medium text-zinc-300">Live transcript</span>
            {(displayEntries.length > 0 || translationEntries.length > 0) && (
              <span className="rounded bg-green-500/20 px-1.5 py-0.5 text-xs text-green-400">
                Live
              </span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {displayEntries.length === 0 && translationEntries.length === 0 ? (
              <p className="text-sm text-zinc-500">
                Transcriptions appear when a transcription agent is in the room. Start speaking to
                see live captions. Translations appear when a translator agent is running.
              </p>
            ) : (
              <div className="space-y-3">
                {displayEntries.length > 0 && (
                  <div className="space-y-2">
                    {displayEntries.map((entry, i) => (
                      <p
                        key={`t-${i}`}
                        className={`text-sm leading-relaxed ${colorMap.get(entry.identity) ?? "text-zinc-400"}`}
                      >
                        <span className="font-semibold">{entry.name}:</span> {entry.text}
                      </p>
                    ))}
                  </div>
                )}
                {translationEntries.length > 0 && (
                  <div className="space-y-2 border-t border-zinc-700/80 pt-3">
                    <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                      Translations
                    </p>
                    {translationEntries.map((entry, i) => (
                      <p
                        key={`tr-${i}`}
                        className={`text-sm leading-relaxed ${colorMap.get(entry.identity) ?? "text-zinc-400"}`}
                      >
                        <span className="font-semibold">
                          {entry.name} ({langLabel(entry.lang)}):
                        </span>{" "}
                        {entry.text}
                      </p>
                    ))}
                  </div>
                )}
                <div ref={transcriptEndRef} />
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="flex shrink-0 items-center justify-center gap-4 border-t border-zinc-800 bg-zinc-900/80 py-4 backdrop-blur">
        <MicButtonWithWaveform />
      </footer>
    </div>
  );
}
