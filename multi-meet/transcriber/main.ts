/**
 * Transcriber agent: STT-only, no TTS/LLM.
 *
 * Pub-sub: LiveKit in-room text stream "lk.transcription".
 * - Publish: This agent (one AgentSession per participant) runs STT and the
 *   AgentSession pipeline publishes each segment to the room on topic "lk.transcription"
 *   (sender identity = the participant who was transcribed).
 * - Subscribe: The Next.js room UI uses useTranscriptions(), which subscribes to
 *   that same topic and renders lines in the Transcript (LiveKit) section.
 */
import "./env";
import { fileURLToPath } from "node:url";
import { RoomEvent, type RemoteParticipant } from "@livekit/rtc-node";
import {
  type JobContext,
  type JobProcess,
  ServerOptions,
  AutoSubscribe,
  cli,
  defineAgent,
  voice,
} from "@livekit/agents";
import * as livekit from "@livekit/agents-plugin-livekit";
import * as silero from "@livekit/agents-plugin-silero";

const TRANSCRIBER_AGENT_NAME = "transcriber";

class TranscriberAgent extends voice.Agent {
  constructor() {
    super({
      instructions:
        "You are a silent transcription agent. You only transcribe; you do not speak or respond.",
    });
  }
}

export default defineAgent({
  prewarm: async (proc: JobProcess) => {
    proc.userData.vad = await silero.VAD.load();
  },
  entry: async (ctx: JobContext) => {
    const vad = ctx.proc.userData.vad as silero.VAD;

    ctx.addParticipantEntrypoint(async (jobCtx, participant) => {
      const session = new voice.AgentSession({
        vad,
        stt: "deepgram/nova-3:multi",
        turnDetection: new livekit.turnDetector.MultilingualModel(),
      });
      await session.start({
        agent: new TranscriberAgent(),
        room: jobCtx.room,
        inputOptions: {
          participantIdentity: participant.identity,
          textEnabled: false,
        },
        outputOptions: {
          audioEnabled: false,
          syncTranscription: false,
        },
      });
      await new Promise<void>((resolve) => {
        const handler = (p: RemoteParticipant) => {
          if (p.identity === participant.identity) {
            jobCtx.room.off(RoomEvent.ParticipantDisconnected, handler);
            void session.close().then(() => resolve());
          }
        };
        jobCtx.room.on(RoomEvent.ParticipantDisconnected, handler);
      });
    });

    await ctx.connect(undefined, AutoSubscribe.AUDIO_ONLY);
  },
});

cli.runApp(
  new ServerOptions({
    agent: fileURLToPath(import.meta.url),
    agentName: TRANSCRIBER_AGENT_NAME,
  })
);
