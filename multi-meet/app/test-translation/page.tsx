"use client";

import {
  LiveKitRoom,
  useLocalParticipant,
  useParticipants,
  useRoomContext,
  useSpeakingParticipants,
} from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const LANGUAGE_OPTIONS: { code: string; label: string }[] = [
  { code: "en", label: "English" },
  { code: "hi", label: "Hindi" },
  { code: "ta", label: "Tamil" },
];

const CHUNK_MS = 2000;
const TOKEN_KEY_PREFIX = "lk_token_";
const CREATOR_KEY_PREFIX = "lk_creator_";

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return typeof btoa !== "undefined" ? btoa(binary) : "";
}

export type RoomCaption = {
  speakerName: string;
  speakerIdentity: string;
  sourceLang: string;
  transcript: string;
  translations: { en: string; hi: string; ta: string };
};

export default function TestTranslationPage() {
  const [roomName, setRoomName] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [createName, setCreateName] = useState("");
  const [joinRoomInput, setJoinRoomInput] = useState("");
  const [joinName, setJoinName] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);
  const [createError, setCreateError] = useState("");
  const [joinError, setJoinError] = useState("");

  const handleCreate = useCallback(async () => {
    const name = createName.trim();
    if (!name) {
      setCreateError("Enter your name");
      return;
    }
    setCreateError("");
    setCreateLoading(true);
    try {
      const res = await fetch("/api/room/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error ?? "Failed to create room");
        return;
      }
      sessionStorage.setItem(TOKEN_KEY_PREFIX + data.roomName, data.token);
      if (data.creatorIdentity != null) {
        sessionStorage.setItem(
          CREATOR_KEY_PREFIX + data.roomName,
          JSON.stringify({
            identity: data.creatorIdentity,
            name: data.creatorName ?? data.creatorIdentity,
          })
        );
      }
      setRoomName(data.roomName);
      setToken(data.token);
    } catch {
      setCreateError("Something went wrong");
    } finally {
      setCreateLoading(false);
    }
  }, [createName]);

  const handleJoin = useCallback(async () => {
    const name = joinName.trim();
    const rn = joinRoomInput.trim();
    if (!rn || !name) {
      setJoinError("Enter room name and your name");
      return;
    }
    setJoinError("");
    setJoinLoading(true);
    try {
      const res = await fetch("/api/room/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomName: rn, name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setJoinError(data.error ?? "Failed to join");
        return;
      }
      sessionStorage.setItem(TOKEN_KEY_PREFIX + rn, data.token);
      setRoomName(rn);
      setToken(data.token);
    } catch {
      setJoinError("Something went wrong");
    } finally {
      setJoinLoading(false);
    }
  }, [joinRoomInput, joinName]);

  if (roomName && token) {
    const serverUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
    if (!serverUrl) {
      return (
        <main className="min-h-screen p-8 flex items-center justify-center">
          <p className="text-red-600">Missing NEXT_PUBLIC_LIVEKIT_URL</p>
        </main>
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
          setToken(null);
          setRoomName(null);
        }}
        className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950"
      >
        <TranslationRoomUI roomName={roomName} />
      </LiveKitRoom>
    );
  }

  return (
    <main className="min-h-screen p-8 max-w-md mx-auto">
      <h1 className="text-2xl font-semibold mb-2 text-zinc-900 dark:text-zinc-100">
        Live captions room
      </h1>
      <p className="text-zinc-600 dark:text-zinc-400 mb-6">
        Create or join a room. When you speak, everyone in the room sees your words as captions with your name.
      </p>

      <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 mb-6">
        <h2 className="text-lg font-medium text-zinc-800 dark:text-zinc-200">Create room</h2>
        <input
          type="text"
          placeholder="Your name"
          value={createName}
          onChange={(e) => setCreateName(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
        />
        {createError && <p className="text-sm text-red-600 dark:text-red-400">{createError}</p>}
        <button
          type="button"
          onClick={handleCreate}
          disabled={createLoading}
          className="w-full rounded-lg bg-zinc-900 py-2.5 font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {createLoading ? "Creating…" : "Create room"}
        </button>
      </section>

      <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-medium text-zinc-800 dark:text-zinc-200">Join room</h2>
        <input
          type="text"
          placeholder="Room name"
          value={joinRoomInput}
          onChange={(e) => setJoinRoomInput(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
        />
        <input
          type="text"
          placeholder="Your name"
          value={joinName}
          onChange={(e) => setJoinName(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
        />
        {joinError && <p className="text-sm text-red-600 dark:text-red-400">{joinError}</p>}
        <button
          type="button"
          onClick={handleJoin}
          disabled={joinLoading}
          className="w-full rounded-lg border border-zinc-300 bg-white py-2.5 font-medium text-zinc-900 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
        >
          {joinLoading ? "Joining…" : "Join"}
        </button>
      </section>
    </main>
  );
}

function TranslationRoomUI({ roomName }: { roomName: string }) {
  const router = useRouter();
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();
  const speakingParticipants = useSpeakingParticipants();
  const [captionByIdentity, setCaptionByIdentity] = useState<Record<string, RoomCaption>>({});
  const [lastSpeakerIdentity, setLastSpeakerIdentity] = useState<string | null>(null);
  const [captionLanguage, setCaptionLanguage] = useState<"en" | "hi" | "ta">("en");
  const [sourceLang, setSourceLang] = useState("en");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const segmentTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingChunksRef = useRef<Blob[]>([]);
  const sendingRef = useRef(false);
  const startSegmentRef = useRef<(() => void) | null>(null);
  const sendCaptionRef = useRef<(blob: Blob) => void>(() => {});

  useEffect(() => {
    const handler = (payload: Uint8Array) => {
      try {
        const str = new TextDecoder().decode(payload);
        const data = JSON.parse(str) as {
          speakerName?: string;
          speakerIdentity?: string;
          sourceLang?: string;
          transcript?: string;
          translations?: { en?: string; hi?: string; ta?: string };
        };
        const speakerIdentity = typeof data.speakerIdentity === "string" ? data.speakerIdentity : "?";
        const speakerName = typeof data.speakerName === "string" ? data.speakerName : "?";
        const sourceLang = typeof data.sourceLang === "string" ? data.sourceLang : "en";
        const transcript = typeof data.transcript === "string" ? data.transcript.trim() : "";
        const translations = data.translations && typeof data.translations === "object"
          ? {
              en: typeof data.translations.en === "string" ? data.translations.en : transcript,
              hi: typeof data.translations.hi === "string" ? data.translations.hi : transcript,
              ta: typeof data.translations.ta === "string" ? data.translations.ta : transcript,
            }
          : { en: transcript, hi: transcript, ta: transcript };
        if (speakerIdentity && transcript) {
          setLastSpeakerIdentity(speakerIdentity);
          setCaptionByIdentity((prev) => ({
            ...prev,
            [speakerIdentity]: { speakerName, speakerIdentity, sourceLang, transcript, translations },
          }));
        }
      } catch {
        // ignore malformed
      }
    };
    room.on(RoomEvent.DataReceived, handler);
    return () => {
      room.off(RoomEvent.DataReceived, handler);
    };
  }, [room]);

  const sendCaption = useCallback(
    async (blob: Blob) => {
      sendingRef.current = true;
      setProcessing(true);
      setErrorMessage(null);
      if (blob.size > 0) {
        try {
          const arrayBuffer = await blob.arrayBuffer();
          const base64 = arrayBufferToBase64(arrayBuffer);
          const res = await fetch("/api/room-caption/process", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ audioBase64: base64, sourceLang }),
          });
          const data = await res.json();
          if (!res.ok) {
            setErrorMessage(data.error ?? "Caption failed");
          } else if (data.ok && typeof data.transcript === "string" && data.transcript.trim()) {
            const speakerName = localParticipant.name ?? localParticipant.identity ?? "You";
            const translations = data.translations && typeof data.translations === "object"
              ? {
                  en: data.translations.en ?? data.transcript,
                  hi: data.translations.hi ?? data.transcript,
                  ta: data.translations.ta ?? data.transcript,
                }
              : { en: data.transcript, hi: data.transcript, ta: data.transcript };
            const payload = new TextEncoder().encode(
              JSON.stringify({
                speakerName,
                speakerIdentity: localParticipant.identity,
                sourceLang,
                transcript: data.transcript.trim(),
                translations,
              })
            );
            await localParticipant.publishData(payload, { reliable: false });
          }
        } catch (e) {
          setErrorMessage(e instanceof Error ? e.message : "Request failed");
        }
      }
      sendingRef.current = false;
      setProcessing(false);
      const next = pendingChunksRef.current.shift();
      if (next) sendCaptionRef.current(next);
    },
    [sourceLang, localParticipant]
  );

  useEffect(() => {
    sendCaptionRef.current = sendCaption;
  }, [sendCaption]);

  const queueOrSend = useCallback((blob: Blob) => {
    if (sendingRef.current) {
      pendingChunksRef.current.push(blob);
      return;
    }
    sendCaptionRef.current(blob);
  }, []);

  const startSegment = useCallback(() => {
    const stream = streamRef.current;
    if (!stream || !stream.active) return;
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream);
    mediaRecorderRef.current = recorder;
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      queueOrSend(blob);
      if (streamRef.current?.active) {
        segmentTimeoutRef.current = setTimeout(() => startSegmentRef.current?.(), 0);
      }
    };
    recorder.start();
    segmentTimeoutRef.current = setTimeout(() => {
      if (recorder.state === "recording") recorder.stop();
    }, CHUNK_MS);
  }, [queueOrSend]);

  useEffect(() => {
    startSegmentRef.current = startSegment;
  }, [startSegment]);

  const startSpeaking = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setIsSpeaking(true);
      setErrorMessage(null);
      startSegment();
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : "Failed to get microphone");
    }
  }, [startSegment]);

  const stopSpeaking = useCallback(() => {
    if (segmentTimeoutRef.current) {
      clearTimeout(segmentTimeoutRef.current);
      segmentTimeoutRef.current = null;
    }
    const recorder = mediaRecorderRef.current;
    const stream = streamRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    stream?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
    setIsSpeaking(false);
  }, []);

  const handleLeave = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY_PREFIX + roomName);
    sessionStorage.removeItem(CREATOR_KEY_PREFIX + roomName);
    router.push("/test-translation");
  }, [roomName, router]);

  const speakingSet = new Set(speakingParticipants.map((p) => p.identity));
  const activeIdentity = speakingParticipants.length > 0
    ? speakingParticipants[0]?.identity
    : lastSpeakerIdentity;

  return (
    <div className="flex flex-1 flex-col min-h-screen bg-zinc-950 text-zinc-100">
      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <h1 className="text-lg font-semibold">{roomName}</h1>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-zinc-400">
            Caption language
            <select
              value={captionLanguage}
              onChange={(e) => setCaptionLanguage(e.target.value as "en" | "hi" | "ta")}
              className="rounded bg-zinc-800 border border-zinc-700 px-2 py-1.5 text-zinc-100 text-sm"
            >
              {LANGUAGE_OPTIONS.map(({ code, label }) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={handleLeave}
            className="text-sm text-zinc-400 hover:text-zinc-200"
          >
            Leave
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-4">
        <div className="flex flex-wrap gap-4 justify-center">
          {participants.map((p) => {
            const name = p.name ?? p.identity;
            const initial = name.slice(0, 1).toUpperCase();
            const caption = captionByIdentity[p.identity];
            const isActive = p.identity === activeIdentity;
            const sourceLabel = caption
              ? LANGUAGE_OPTIONS.find((o) => o.code === caption.sourceLang)?.label ?? caption.sourceLang
              : "—";
            const translated = caption ? caption.translations[captionLanguage] ?? caption.transcript : "";

            return (
              <div
                key={p.identity}
                className={`w-full max-w-sm rounded-xl border-2 bg-zinc-900 p-4 transition-shadow ${
                  isActive
                    ? "border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.3)]"
                    : "border-zinc-700"
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-violet-600 text-lg font-semibold">
                    {initial}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-white truncate">{name}</p>
                    {p.isLocal && (
                      <span className="text-xs text-zinc-400">You</span>
                    )}
                    <p className="text-xs text-zinc-500">Speaks: {sourceLabel}</p>
                  </div>
                </div>
                <div className="rounded-lg bg-zinc-800 p-3 min-h-[4rem]">
                  {caption ? (
                    <>
                      <p className="text-sm text-emerald-400 mb-1.5">{caption.transcript}</p>
                      {translated && translated !== caption.transcript && (
                        <p className="text-sm text-zinc-400 flex items-start gap-1.5">
                          <span className="shrink-0 w-4 h-4 rounded-full bg-sky-500/30 inline-block mt-0.5" />
                          {translated}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-zinc-500 italic">No caption yet</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <footer className="border-t border-zinc-800 px-4 py-4 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-zinc-400">
          I speak
          <select
            value={sourceLang}
            onChange={(e) => setSourceLang(e.target.value)}
            disabled={isSpeaking}
            className="rounded bg-zinc-800 border border-zinc-700 px-2 py-1.5 text-zinc-100 text-sm disabled:opacity-50"
          >
            {LANGUAGE_OPTIONS.map(({ code, label }) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {errorMessage && (
          <span className="text-sm text-red-400">{errorMessage}</span>
        )}
        {isSpeaking && processing && (
          <span className="text-sm text-amber-400">Processing…</span>
        )}
        {!isSpeaking ? (
          <button
            type="button"
            onClick={startSpeaking}
            className="rounded-lg bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-500"
          >
            Unmute
          </button>
        ) : (
          <button
            type="button"
            onClick={stopSpeaking}
            className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-500"
          >
            Mute
          </button>
        )}
      </footer>
    </div>
  );
}
