import { AudioRoom } from "@/components/audio-room";

export default async function RoomPage({
  params,
}: { params: Promise<{ roomName: string }> }) {
  const { roomName } = await params;
  return <AudioRoom roomName={roomName} />;
}
