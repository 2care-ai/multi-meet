"use client"

import type { ProcessTranslationRequest, ProcessTranslationResponse } from "@/types/pipeline"
import type { TranslationRoomMessage } from "@/types/translation"
import {
  LiveKitRoom,
  ParticipantLoop,
  TrackToggle,
  useDataChannel,
  useParticipantInfo,
  useParticipants,
  useTracks,
  useTrackToggle,
} from "@livekit/components-react"
import { Track } from "livekit-client"
import { useCallback, useEffect, useRef, useState } from "react"
import { ParticipantView } from "./ParticipantView"

type Props = {
  token: string
  roomId: string
  speakerId: string
  speakerLanguage: string
}

function ParticipantRow({
  targetParticipants,
}: {
  targetParticipants: Array<{ id: string; language: string }>
}) {
  const { identity, name } = useParticipantInfo()
  const language = identity
    ? targetParticipants.find((p) => p.id === identity)?.language
    : undefined
  return (
    <ParticipantView
      identity={name ?? identity ?? "Unknown"}
      language={language}
    />
  )
}

function parseTranslationMessage(payload: Uint8Array): TranslationRoomMessage | null {
  try {
    const json = new TextDecoder().decode(payload)
    const data = JSON.parse(json) as TranslationRoomMessage
    if (data?.type === "translation" && data.translations) return data
    return null
  } catch {
    return null
  }
}

function TranslationRoomInner({
  roomId,
  speakerId,
  speakerLanguage,
  targetParticipants,
}: {
  roomId: string
  speakerId: string
  speakerLanguage: string
  targetParticipants: Array<{ id: string; language: string }>
}) {
  const participants = useParticipants()
  const tracks = useTracks([Track.Source.Microphone, Track.Source.Camera])
  const [processError, setProcessError] = useState<string | null>(null)
  const [liveTranscript, setLiveTranscript] = useState<{
    speakerName: string
    text: string
  } | null>(null)
  const sendingRef = useRef(false)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const { enabled: micEnabled } = useTrackToggle({
    source: Track.Source.Microphone,
    initialState: false,
  })

  useDataChannel(
    "translation",
    useCallback((msg: { payload: Uint8Array }) => {
      const data = parseTranslationMessage(msg.payload)
      if (!data) return
      const text =
        data.translations[speakerLanguage] ??
        data.transcription
      if (text) {
        setLiveTranscript({
          speakerName: data.speakerName ?? data.speakerId,
          text,
        })
      }
    }, [speakerLanguage])
  )

  const sendTranslation = useCallback(
    async (audioBase64?: string, audioMimeType?: "audio/webm" | "audio/ogg") => {
      if (!audioBase64) return
      if (sendingRef.current) return
      sendingRef.current = true
      setProcessError(null)
      const body: ProcessTranslationRequest = {
        roomId,
        speakerId,
        speakerLanguage,
        targetParticipants,
        audioBase64,
        ...(audioMimeType && { audioMimeType }),
      }
      console.log("[TranslationRoom] Sending audio chunk for live transcription", {
        roomId,
        speakerId,
        targetCount: targetParticipants.length,
      })
      try {
        const res = await fetch("/api/translation/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        const data = (await res.json().catch(() => ({}))) as ProcessTranslationResponse
        if (!res.ok) {
          const err = "error" in data ? data.error : `Request failed: ${res.status}`
          setProcessError(err)
          console.warn("[TranslationRoom] Translation request failed", { status: res.status, error: err })
        } else if (!data.ok) {
          const err = "error" in data ? data.error : "Translation failed"
          setProcessError(err)
          console.warn("[TranslationRoom] Translation failed", { error: err })
        } else {
          const text = data.ok && "transcription" in data ? data.transcription : undefined
          if (text && text !== "(transcription will appear when pipeline is connected)") {
            setLiveTranscript({ speakerName: speakerId, text })
          }
          if (text) console.log("[TranslationRoom] Live transcription:", text)
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Request failed"
        setProcessError(msg)
        console.warn("[TranslationRoom] Translation request error", msg)
      } finally {
        sendingRef.current = false
      }
    },
    [roomId, speakerId, speakerLanguage, targetParticipants]
  )

  useEffect(() => {
    if (!micEnabled) return
    const localAudioTrack = tracks.find(
      (t) => t.participant.identity === speakerId && t.source === Track.Source.Microphone
    )?.publication?.track
    if (!localAudioTrack?.mediaStreamTrack) return
    const stream = new MediaStream([localAudioTrack.mediaStreamTrack])
    const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/ogg"
    const startRecording = () => {
      if (recorderRef.current?.state === "recording") return
      const recorder = new MediaRecorder(stream, { mimeType: mime })
      recorderRef.current = recorder
      const chunks: Blob[] = []
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data)
      }
      recorder.onstop = () => {
        if (chunks.length === 0) return
        const blob = new Blob(chunks, { type: mime })
        const reader = new FileReader()
        reader.onloadend = () => {
          const dataUrl = reader.result as string
          const base64 = dataUrl.split(",")[1]
          if (base64) {
            console.log("[TranslationRoom] Audio chunk captured", { sizeBytes: blob.size, mimeType: mime })
            sendTranslation(base64, mime as "audio/webm" | "audio/ogg")
          }
        }
        reader.readAsDataURL(blob)
      }
      recorder.start(800)
      setTimeout(() => {
        if (recorder.state === "recording") recorder.stop()
      }, 800)
    }
    const interval = setInterval(startRecording, 1000)
    return () => {
      clearInterval(interval)
      if (recorderRef.current?.state === "recording") recorderRef.current.stop()
      recorderRef.current = null
    }
  }, [micEnabled, speakerId, tracks, sendTranslation])

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <TrackToggle
          source={Track.Source.Microphone}
          initialState={false}
          showIcon={false}
          className="flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
        >
          {micEnabled ? (
            <>
              <span className="inline-block h-3 w-3 rounded-full bg-red-500" aria-hidden />
              Mute
            </>
          ) : (
            <>
              <span className="inline-block h-3 w-3 rounded-full border-2 border-zinc-400 dark:border-zinc-500" aria-hidden />
              Unmute to talk
            </>
          )}
        </TrackToggle>
      </div>
      {processError && (
        <p className="text-sm text-red-600 dark:text-red-400">{processError}</p>
      )}
      {liveTranscript && (
        <section className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            In your language ({speakerLanguage})
          </p>
          <p className="mt-1 font-medium text-zinc-900 dark:text-zinc-100">
            {liveTranscript.speakerName} said:
          </p>
          <p className="mt-0.5 text-zinc-700 dark:text-zinc-300">
            {liveTranscript.text}
          </p>
        </section>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <ParticipantLoop participants={participants}>
          <ParticipantRow targetParticipants={targetParticipants} />
        </ParticipantLoop>
      </div>
    </div>
  )
}

export function TranslationRoom({
  token,
  roomId,
  speakerId,
  speakerLanguage,
}: Props) {
  const [targetParticipants, setTargetParticipants] = useState<
    Array<{ id: string; language: string }>
  >([])

  useEffect(() => {
    let cancelled = false
    const fetchParticipants = () => {
      fetch(`/api/room/${roomId}/participants`)
        .then((r) => r.json())
        .then((data: { participants?: Array<{ id: string; language: string }> }) => {
          if (cancelled || !data.participants) return
          const targets = data.participants.filter((p) => p.id !== speakerId)
          setTargetParticipants(targets)
        })
        .catch(() => {})
    }
    fetchParticipants()
    const interval = setInterval(fetchParticipants, 5000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [roomId, speakerId])

  const serverUrl =
    typeof process.env.NEXT_PUBLIC_LIVEKIT_URL === "string"
      ? process.env.NEXT_PUBLIC_LIVEKIT_URL
      : undefined

  if (!serverUrl) {
    return (
      <p className="p-4 text-red-600 dark:text-red-400">
        NEXT_PUBLIC_LIVEKIT_URL is not set.
      </p>
    )
  }

  return (
    <LiveKitRoom
      serverUrl={serverUrl}
      token={token}
      audio
      video={false}
      connect
      className="min-h-screen"
    >
      <TranslationRoomInner
        roomId={roomId}
        speakerId={speakerId}
        speakerLanguage={speakerLanguage}
        targetParticipants={targetParticipants}
      />
    </LiveKitRoom>
  )
}
