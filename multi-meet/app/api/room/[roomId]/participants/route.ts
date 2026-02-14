import { getRoomMembers, getUserConfig } from "@/lib/redis"
import { NextResponse } from "next/server"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params
  const membersResult = await getRoomMembers(roomId)
  if (membersResult.isErr()) {
    return NextResponse.json(
      { error: membersResult.error.message },
      { status: 500 }
    )
  }
  const members = membersResult.value
  const participants: Array<{ id: string; language: string }> = []
  for (const userId of members) {
    const configResult = await getUserConfig(userId, roomId)
    if (configResult.isErr()) continue
    const config = configResult.value
    if (config) participants.push({ id: userId, language: config.language })
  }
  return NextResponse.json({ participants })
}
