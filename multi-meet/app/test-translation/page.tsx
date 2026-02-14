"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const LANGUAGE_OPTIONS: { code: string; label: string }[] = [
  { code: "en", label: "English" },
  { code: "hi", label: "Hindi" },
  { code: "ta", label: "Tamil" },
];

const CHUNK_MS = 2000;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return typeof btoa !== "undefined" ? btoa(binary) : "";
}

type ResultItem = { targetLang: string; translatedText: string; audioBase64: string };

export default function TestTranslationPage() {
  const [sourceLang, setSourceLang] = useState("en");
  const [targetLangs, setTargetLangs] = useState<string[]>(["hi"]);
  const [isLive, setIsLive] = useState(false);
  const [segments, setSegments] = useState<ResultItem[][]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const segmentTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingChunksRef = useRef<Blob[]>([]);
  const sendingRef = useRef(false);
  const startSegmentRef = useRef<(() => void) | null>(null);
  const sendChunkRef = useRef<(blob: Blob) => void>(() => {});

  const toggleTarget = useCallback((code: string) => {
    setTargetLangs((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  }, []);

  const sendChunk = useCallback(
    async (blob: Blob) => {
      if (targetLangs.length === 0) return;
      sendingRef.current = true;
      setProcessing(true);
      setErrorMessage(null);
      if (blob.size > 0) {
        try {
          const arrayBuffer = await blob.arrayBuffer();
          const base64 = arrayBufferToBase64(arrayBuffer);
          const res = await fetch("/api/translation/process", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              audioBase64: base64,
              sourceLang,
              targetLangs,
            }),
          });
          const data = await res.json();
          if (!res.ok) {
            setErrorMessage(data.error ?? "Translation failed");
          } else if (data.ok && Array.isArray(data.results) && data.results.length > 0) {
            setSegments((prev) => [...prev, data.results]);
          }
        } catch (e) {
          setErrorMessage(e instanceof Error ? e.message : "Request failed");
        }
      }
      sendingRef.current = false;
      setProcessing(false);
      const next = pendingChunksRef.current.shift();
      if (next) sendChunkRef.current(next);
    },
    [sourceLang, targetLangs]
  );

  useEffect(() => {
    sendChunkRef.current = sendChunk;
  }, [sendChunk]);

  const queueOrSendChunk = useCallback((blob: Blob) => {
    if (sendingRef.current) {
      pendingChunksRef.current.push(blob);
      return;
    }
    sendChunkRef.current(blob);
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
      queueOrSendChunk(blob);
      if (streamRef.current?.active) {
        segmentTimeoutRef.current = setTimeout(() => startSegmentRef.current?.(), 0);
      }
    };
    recorder.start();
    segmentTimeoutRef.current = setTimeout(() => {
      if (recorder.state === "recording") recorder.stop();
    }, CHUNK_MS);
  }, [queueOrSendChunk]);

  useEffect(() => {
    startSegmentRef.current = startSegment;
  }, [startSegment]);

  const startLive = useCallback(async () => {
    if (targetLangs.length === 0) {
      setErrorMessage("Select at least one target language");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setIsLive(true);
      setSegments([]);
      setErrorMessage(null);
      startSegment();
    } catch (e) {
      setErrorMessage(
        e instanceof Error ? e.message : "Failed to get microphone"
      );
    }
  }, [targetLangs.length, startSegment]);

  const stopLive = useCallback(() => {
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
    setIsLive(false);
  }, []);

  const sourceLabel =
    LANGUAGE_OPTIONS.find((o) => o.code === sourceLang)?.label ?? sourceLang;

  return (
    <main className="min-h-screen p-8 max-w-2xl">
      <h1 className="text-2xl font-semibold mb-2">Live translation</h1>
      <p className="text-neutral-600 mb-6">
        Choose the language you speak and one or more target languages. Start to begin live translation — speech is sent every few seconds and translations appear below.
      </p>

      <div className="flex flex-wrap items-end gap-4 mb-6">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-neutral-700">
            Language 1 (speak in)
          </span>
          <select
            value={sourceLang}
            onChange={(e) => setSourceLang(e.target.value)}
            disabled={isLive}
            className="rounded border border-neutral-300 bg-white px-3 py-2 text-neutral-900 disabled:opacity-50 min-w-[160px]"
          >
            {LANGUAGE_OPTIONS.map(({ code, label }) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mb-6">
        <span className="text-sm font-medium text-neutral-700 block mb-2">
          Language 2 (translate to) — select any number
        </span>
        <div className="flex flex-wrap gap-4">
          {LANGUAGE_OPTIONS.map(({ code, label }) => (
            <label
              key={code}
              className="flex items-center gap-2 cursor-pointer select-none"
            >
              <input
                type="checkbox"
                checked={targetLangs.includes(code)}
                onChange={() => toggleTarget(code)}
                disabled={isLive}
                className="rounded border-neutral-300"
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex gap-3 mb-6">
        {!isLive ? (
          <button
            type="button"
            onClick={startLive}
            className="rounded bg-green-600 text-white px-4 py-2"
          >
            Start live translation
          </button>
        ) : (
          <button
            type="button"
            onClick={stopLive}
            className="rounded bg-red-600 text-white px-4 py-2"
          >
            Stop
          </button>
        )}
      </div>

      {isLive && (
        <p className="text-amber-600 mb-4">
          Listening in {sourceLabel}… Translations update every {CHUNK_MS / 1000}s.
          {processing && " Processing…"}
        </p>
      )}
      {errorMessage && <p className="text-red-600 mb-4">{errorMessage}</p>}

      <div className="mt-6 space-y-6">
        {segments.map((results, idx) => (
          <div key={idx} className="border border-neutral-200 rounded-lg p-4">
            {results.map((r) => {
              const label =
                LANGUAGE_OPTIONS.find((o) => o.code === r.targetLang)?.label ??
                r.targetLang;
              return (
                <div key={r.targetLang} className="mb-4 last:mb-0">
                  <p className="font-medium text-neutral-700 mb-1">{label}</p>
                  <p className="text-neutral-800 mb-2">
                    {typeof r.translatedText === "string"
                      ? r.translatedText
                      : ""}
                  </p>
                  <audio
                    src={`data:audio/mpeg;base64,${r.audioBase64}`}
                    controls
                    className="w-full max-w-md"
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </main>
  );
}
