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

  const activeIdentity =
    speakingParticipants.length > 0
      ? speakingParticipants[0]?.identity
      : lastSpeakerIdentity;

  const resetCaptions = useCallback(() => {
    setCaptionByIdentity({});
    setLastSpeakerIdentity(null);
  }, []);

  const taglineLabels = LANGUAGE_OPTIONS.map((o) => o.label).join(" • ");

  return (
    <div
      className="min-h-screen text-white p-5 md:p-8"
      style={{
        background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
      }}
    >
      <header className="text-center mb-10">
        <h1
          className="text-4xl md:text-5xl font-extrabold mb-2"
          style={{
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          Moonshot
        </h1>
        <p className="text-lg text-zinc-400 font-light tracking-wide">
          Real-Time Multilingual Meeting • {taglineLabels}
        </p>
      </header>

      <div className="max-w-[1400px] mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
        {(() => {
          const AGENT_ID = "__agent__";
          type ParticipantSlot = (typeof participants)[number] | { type: "agent" };
          const withAgent: ParticipantSlot[] = [
            participants[0],
            { type: "agent" },
            participants[1],
          ].filter(Boolean) as ParticipantSlot[];
          function isAgent(slot: ParticipantSlot): slot is { type: "agent" } {
            return typeof slot === "object" && slot !== null && "type" in slot && slot.type === "agent";
          }
          return withAgent.map((item) => {
            if (isAgent(item)) {
              const caption = captionByIdentity[AGENT_ID];
              const translated = caption
                ? caption.translations[captionLanguage] ?? caption.transcript
                : "";
              return (
                <div
                  key={AGENT_ID}
                  className="rounded-2xl p-6 border-2 border-transparent transition-all duration-300 relative overflow-hidden bg-white/5 backdrop-blur-md border-violet-500/50"
                >
                  <div className="relative z-10">
                    <div
                      className="w-[90px] h-[90px] rounded-full mx-auto mb-5 flex items-center justify-center text-4xl shadow-lg"
                      style={{
                        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                        boxShadow: "0 8px 20px rgba(0,0,0,0.3)",
                      }}
                    >
                      A
                    </div>
                    <div className="text-center mb-5">
                      <div className="font-bold text-xl mb-1">Agent</div>
                      <div className="text-zinc-400 text-sm mb-0.5">AI Assistant</div>
                      <div className="text-[#667eea] text-sm font-semibold">—</div>
                    </div>
                    <div className="bg-black/30 rounded-xl p-4 min-h-[120px]">
                      <div className="text-green-500 font-semibold text-[15px] mb-3 leading-relaxed min-h-[40px]">
                        {caption ? caption.transcript : ""}
                      </div>
                      <div className="text-zinc-300 text-sm leading-relaxed italic min-h-[40px]">
                        {caption && translated && translated !== caption.transcript ? (
                          <>
                            <span className="opacity-60">🌐 </span>
                            {translated}
                          </>
                        ) : null}
                      </div>
                      {!caption && (
                        <p className="text-zinc-500 text-sm italic">Agent responses will appear here.</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            }
            const p = item as (typeof participants)[number];
            const name = p.name ?? p.identity;
            const initial = name.slice(0, 1).toUpperCase();
            const caption = captionByIdentity[p.identity];
            const isSpeaking = p.identity === activeIdentity;
            const isTranslating = p.isLocal && processing;
            const sourceLabel = caption
              ? LANGUAGE_OPTIONS.find((o) => o.code === caption.sourceLang)?.label ?? caption.sourceLang
              : "—";
            const translated = caption
              ? caption.translations[captionLanguage] ?? caption.transcript
              : "";

            return (
              <div
                key={p.identity}
                className={`
                  rounded-2xl p-6 border-2 transition-all duration-300 relative overflow-hidden
                  bg-white/5 backdrop-blur-md
                  ${isSpeaking ? "border-green-500 scale-[1.02] shadow-[0_0_30px_rgba(76,175,80,0.6)]" : "border-transparent"}
                  ${isTranslating ? "border-amber-500 animate-pulse shadow-[0_0_20px_rgba(255,152,0,0.4)]" : ""}
                `}
                style={
                  isSpeaking
                    ? {
                        boxShadow: "0 0 30px rgba(76, 175, 80, 0.6)",
                      }
                    : undefined
                }
              >
                <div
                  className="absolute inset-0 transition-opacity duration-300 pointer-events-none rounded-2xl"
                  style={{
                    background: "linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)",
                    opacity: isSpeaking ? 1 : 0,
                  }}
                />
                <div className="relative z-10">
                  <div
                    className="w-[90px] h-[90px] rounded-full mx-auto mb-5 flex items-center justify-center text-4xl shadow-lg"
                    style={{
                      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                      boxShadow: "0 8px 20px rgba(0,0,0,0.3)",
                    }}
                  >
                    {initial}
                  </div>
                  <div className="text-center mb-5">
                    <div className="font-bold text-xl mb-1">{name}</div>
                    {p.isLocal && (
                      <div className="text-zinc-400 text-sm mb-0.5">You</div>
                    )}
                    <div className="text-[#667eea] text-sm font-semibold">
                      {sourceLabel !== "—" ? `Speaks: ${sourceLabel}` : "—"}
                    </div>
                  </div>
                  <div className="bg-black/30 rounded-xl p-4 min-h-[120px]">
                    <div className="text-green-500 font-semibold text-[15px] mb-3 leading-relaxed min-h-[40px]">
                      {caption ? caption.transcript : ""}
                    </div>
                    <div className="text-zinc-300 text-sm leading-relaxed italic min-h-[40px]">
                      {caption && translated && translated !== caption.transcript ? (
                        <>
                          <span className="opacity-60">🌐 </span>
                          {translated}
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            );
          });
        })()}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-4 mb-8">
        <label className="flex items-center gap-2 text-zinc-300 text-sm">
          Caption language
          <select
            value={captionLanguage}
            onChange={(e) => setCaptionLanguage(e.target.value as "en" | "hi" | "ta")}
            className="rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-white text-sm"
          >
            {LANGUAGE_OPTIONS.map(({ code, label }) => (
              <option key={code} value={code} className="bg-zinc-800 text-white">
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-zinc-300 text-sm">
          I speak
          <select
            value={sourceLang}
            onChange={(e) => setSourceLang(e.target.value)}
            disabled={isSpeaking}
            className="rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-white text-sm disabled:opacity-50"
          >
            {LANGUAGE_OPTIONS.map(({ code, label }) => (
              <option key={code} value={code} className="bg-zinc-800 text-white">
                {label}
              </option>
            ))}
          </select>
        </label>
        {!isSpeaking ? (
          <button
            type="button"
            onClick={startSpeaking}
            className="rounded-full px-10 py-4 text-lg font-semibold text-white border-0 cursor-pointer transition-all hover:-translate-y-0.5 shadow-lg"
            style={{
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              boxShadow: "0 4px 15px rgba(102, 126, 234, 0.4)",
            }}
          >
            Start speaking
          </button>
        ) : (
          <button
            type="button"
            onClick={stopSpeaking}
            className="rounded-full px-10 py-4 text-lg font-semibold text-white bg-red-600 border-0 cursor-pointer transition-all hover:-translate-y-0.5"
          >
            Stop
          </button>
        )}
        <button
          type="button"
          onClick={resetCaptions}
          className="fixed top-5 right-5 z-[1000] rounded-full px-4 py-2 text-xs font-semibold text-white border-0 cursor-pointer"
          style={{
            background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
            boxShadow: "0 4px 15px rgba(245, 87, 108, 0.4)",
          }}
        >
          Reset captions
        </button>
        <button
          type="button"
          onClick={handleLeave}
          className="rounded-full px-6 py-2 text-sm text-zinc-300 hover:text-white border border-white/20"
        >
          Leave
        </button>
      </div>

      {(errorMessage || (isSpeaking && processing)) && (
        <div
          className={`max-w-2xl mx-auto text-center text-lg font-semibold py-4 px-4 rounded-xl min-h-[50px] flex items-center justify-center ${
            errorMessage ? "bg-red-500/10 border border-red-500/30 text-red-400" : "bg-amber-500/10 border border-amber-500/30 text-amber-500"
          }`}
        >
          {errorMessage ? (
            errorMessage
          ) : (
            <>
              <span
                className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 mr-2 animate-pulse"
              />
              Processing…
            </>
          )}
        </div>
      )}
    </div>
  );
}
