import { err } from "neverthrow";
import { processParticipantAudio } from "./translation-pipeline";
import type { TargetParticipant, TranslatedAudioResult } from "@/types/pipeline";

const MIN_SAMPLES = 3200;

const buffers = new Map<string, Buffer[]>();

function getOrCreateBuffer(participantId: string): Buffer[] {
  let buf = buffers.get(participantId);
  if (!buf) {
    buf = [];
    buffers.set(participantId, buf);
  }
  return buf;
}

export function bufferAudio(participantId: string, chunk: Buffer): void {
  const buf = getOrCreateBuffer(participantId);
  buf.push(chunk);
}

export function clearBuffer(participantId: string): void {
  buffers.delete(participantId);
}

export function getBufferedLength(participantId: string): number {
  const buf = buffers.get(participantId);
  if (!buf) return 0;
  return buf.reduce((acc, b) => acc + b.length, 0);
}

export function isBufferReady(participantId: string): boolean {
  return getBufferedLength(participantId) >= MIN_SAMPLES * 2;
}

export function getAndClearBuffer(participantId: string): Buffer | null {
  const buf = buffers.get(participantId);
  if (!buf || buf.length === 0) return null;
  const combined = Buffer.concat(buf);
  buffers.set(participantId, []);
  return combined;
}

export async function processBufferedAudio(
  participantId: string,
  speakerLanguage: string,
  targetParticipants: TargetParticipant[]
): Promise<import("neverthrow").Result<TranslatedAudioResult[], string>> {
  const audioBuffer = getAndClearBuffer(participantId);
  if (!audioBuffer || audioBuffer.length === 0) return err("No audio");
  return processParticipantAudio(audioBuffer, speakerLanguage, targetParticipants);
}
