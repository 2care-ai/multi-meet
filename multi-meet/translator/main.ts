/**
 * Translation agent: subscribes to lk.transcription, runs translate (en→hi) + TTS,
 * publishes Hindi audio as a room track so participants can hear it.
 */
import "./env";
import { fileURLToPath } from "node:url";
import {
  AudioFrame,
  AudioSource,
  LocalAudioTrack,
  RoomEvent,
  TrackPublishOptions,
  type TextStreamReader,
} from "@livekit/rtc-node";
import {
  type JobContext,
  type JobProcess,
  ServerOptions,
  AutoSubscribe,
  cli,
  defineAgent,
} from "@livekit/agents";
import { translateText } from "../lib/gemini-translate";
import { synthesizeSpeechPcm } from "../lib/elevenlabs-tts";

const TRANSLATOR_AGENT_NAME = "translator";
const TRANSCRIPTION_TOPIC = "lk.transcription";
const TRANSLATION_TOPIC = "lk.translation";
const SOURCE_LANG = "en";
const TARGET_LANG = "hi";

function getTargetLangs(): string[] {
  const raw = process.env.TRANSLATION_TARGET_LANGS;
  if (!raw?.trim()) return [TARGET_LANG];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}
const SAMPLE_RATE = 24_000;
const NUM_CHANNELS = 1;
const SAMPLES_PER_FRAME_20MS = (SAMPLE_RATE * 20) / 1000;

function pcmToAudioFrames(
  pcm: Buffer,
  sampleRate: number,
  numChannels: number
): AudioFrame[] {
  const frames: AudioFrame[] = [];
  const sampleCount = pcm.length / 2;
  let offset = 0;
  const samplesPerFrame = (sampleRate * 20) / 1000 * numChannels;
  while (offset + samplesPerFrame <= sampleCount) {
    const chunk = pcm.subarray(offset * 2, (offset + samplesPerFrame) * 2);
    const int16 = new Int16Array(
      chunk.buffer,
      chunk.byteOffset,
      chunk.length / 2
    );
    frames.push(
      new AudioFrame(
        int16,
        sampleRate,
        numChannels,
        samplesPerFrame / numChannels
      )
    );
    offset += samplesPerFrame;
  }
  return frames;
}

export default defineAgent({
  entry: async (ctx: JobContext) => {
    const apiKey = process.env.ELEVEN_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || !geminiKey) {
      throw new Error("ELEVEN_API_KEY and GEMINI_API_KEY are required for the translator");
    }

    const audioSource = new AudioSource(SAMPLE_RATE, NUM_CHANNELS);
    const hindiTrack = LocalAudioTrack.createAudioTrack("hindi", audioSource);
    let processing = false;

    ctx.room.registerTextStreamHandler(
      TRANSCRIPTION_TOPIC,
      async (reader: TextStreamReader, participantInfo: { identity: string }) => {
        if (processing) return;
        const isFinal =
          reader.info.attributes?.["lk.transcription_final"] === "true";
        if (!isFinal) return;
        processing = true;
        try {
          const text = (await reader.readAll()) as string;
          if (!text?.trim()) return;
          const speakerIdentity = participantInfo.identity;
          const targetLangs = getTargetLangs();
          const primaryLang = targetLangs[0] ?? TARGET_LANG;
          const translated = await translateText(
            text.trim(),
            SOURCE_LANG,
            primaryLang,
            geminiKey
          );
          if (translated.isErr()) return;
          if (ctx.room.localParticipant) {
            await ctx.room.localParticipant.sendText(translated.value, {
              topic: TRANSLATION_TOPIC,
              attributes: {
                "lk.translation_lang": primaryLang,
                "lk.translation_speaker": speakerIdentity,
              },
            });
          }
          for (const lang of targetLangs.slice(1)) {
            const extra = await translateText(text.trim(), SOURCE_LANG, lang, geminiKey);
            if (extra.isOk() && ctx.room.localParticipant) {
              await ctx.room.localParticipant.sendText(extra.value, {
                topic: TRANSLATION_TOPIC,
                attributes: {
                  "lk.translation_lang": lang,
                  "lk.translation_speaker": speakerIdentity,
                },
              });
            }
          }
          const tts = await synthesizeSpeechPcm(translated.value, apiKey);
          if (tts.isErr()) return;
          const frames = pcmToAudioFrames(
            tts.value.pcm,
            tts.value.sampleRate,
            tts.value.numChannels
          );
          for (const frame of frames) {
            await audioSource.captureFrame(frame);
          }
        } finally {
          processing = false;
        }
      }
    );

    await ctx.connect(undefined, AutoSubscribe.AUDIO_ONLY);

    if (ctx.room.localParticipant) {
      await ctx.room.localParticipant.publishTrack(hindiTrack, new TrackPublishOptions({}));
    }

    await new Promise<void>((resolve) => {
      ctx.room.on(RoomEvent.Disconnected, () => resolve());
    });
  },
});

cli.runApp(
  new ServerOptions({
    agent: fileURLToPath(import.meta.url),
    agentName: TRANSLATOR_AGENT_NAME,
  })
);
