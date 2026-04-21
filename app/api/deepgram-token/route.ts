import { NextResponse } from "next/server"
import { DeepgramClient } from "@deepgram/sdk"

export async function GET(req: Request) {
  const apiKey = req.headers.get("x-deepgram-key") || process.env.DEEPGRAM_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: "DEEPGRAM_API_KEY is not configured" },
      { status: 500 }
    )
  }

  const client = new DeepgramClient({ apiKey })

  // 1. Get the project ID
  const { projects } = await client.manage.v1.projects.list()
  const projectId = projects?.[0]?.project_id
  if (!projectId) {
    return NextResponse.json(
      { error: "No Deepgram project found" },
      { status: 500 }
    )
  }

  // 2. Create a short-lived API key scoped to transcription only
  const keyResponse = await client.manage.v1.projects.keys.create(projectId, {
    comment: "telly-temp",
    scopes: ["usage:write"],
    time_to_live_in_seconds: 30,
  } as Record<string, unknown>)

  return NextResponse.json({
    key: keyResponse.key,
  })
}
