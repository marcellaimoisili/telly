import { NextResponse } from "next/server"
import { DeepgramClient } from "@deepgram/sdk"

export async function GET() {
  const apiKey = process.env.DEEPGRAM_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: "DEEPGRAM_API_KEY is not configured" },
      { status: 500 }
    )
  }

  const client = new DeepgramClient({ apiKey })

  const response = await client.auth.v1.tokens.grant({
    ttl_seconds: 30,
  })

  return NextResponse.json({
    token: response.access_token,
    expiresIn: response.expires_in,
  })
}
