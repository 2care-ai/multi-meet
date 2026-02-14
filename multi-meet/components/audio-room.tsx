"use client";

import {
  LiveKitRoom,
  RoomAudioRenderer,
  TrackToggle,
  useLocalParticipant,
  useParticipants,
  useRoomContext,
  useTranscriptions,
} from "@livekit/components-react";
import { type Participant, ParticipantEvent, RoomEvent, Track } from "livekit-client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

const TOKEN_KEY_PREFIX = "lk_token_";
const CREATOR_KEY_PREFIX = "lk_creator_";

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
      className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950"
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

function AudioRoomUI({ roomName }: { roomName: string }) {
  const router = useRouter();
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const transcriptions = useTranscriptions();
  const creator = getStoredCreator(roomName);

  useSpeakingLogs(roomName);
  useTranscriptionLogs(roomName);

  const handleLeave = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY_PREFIX + roomName);
    sessionStorage.removeItem(CREATOR_KEY_PREFIX + roomName);
    router.push("/");
  }, [roomName, router]);

  const displayEntries = transcriptions.map((t) => {
    const pi = t.participantInfo as { identity: string; name?: string };
    return {
      identity: pi?.identity ?? "?",
      name: pi?.name ?? pi?.identity ?? "?",
      text: t.text ?? "",
    };
  });

  const identityList = displayEntries.map((e) => e.identity);
  const identities = [...new Set(identityList)];
  const colorMap = useParticipantColorMap(
    identities,
    creator?.identity ?? null,
    localParticipant.identity
  );

  return (
    <div className="flex flex-1 flex-col p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          {roomName}
        </h1>
        <button
          type="button"
          onClick={handleLeave}
          className="text-sm text-zinc-600 hover:underline dark:text-zinc-400"
        >
          Leave
        </button>
      </div>
      <ul className="mb-4 space-y-2">
        {participants.map((p) => (
          <li
            key={p.identity}
            className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              {p.name ?? p.identity}
            </span>
            {p.isLocal && (
              <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-xs dark:bg-zinc-700">
                You
              </span>
            )}
            {creator && p.identity === creator.identity && (
              <span className="rounded bg-amber-200 px-1.5 py-0.5 text-xs text-amber-900 dark:bg-amber-800 dark:text-amber-100">
                Creator
              </span>
            )}
          </li>
        ))}
      </ul>
      <section className="mb-6 flex-1 overflow-auto rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900">
        <h2 className="mb-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Transcript (LiveKit)
        </h2>
        <div className="min-h-[4rem] text-sm text-zinc-800 dark:text-zinc-200">
          {displayEntries.length === 0 && (
            <span className="text-zinc-400">
              Transcriptions appear when a transcription agent is in the room.
            </span>
          )}
          {displayEntries.map((entry, i) => (
            <p key={i} className={`mb-1 ${colorMap.get(entry.identity) ?? "text-zinc-700 dark:text-zinc-300"}`}>
              <span className="font-medium">{entry.name}:</span> {entry.text}
            </p>
          ))}
        </div>
      </section>
      <div className="mt-auto flex justify-center">
        <TrackToggle
          source={Track.Source.Microphone}
          className="rounded-full bg-zinc-900 px-6 py-3 font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        />
      </div>
    </div>
  );
}
