import { NextResponse } from "next/server"
import OpenAI from "openai"

const openai = new OpenAI() // reads OPENAI_API_KEY from env

const MAX_TEXTS = 500

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured" },
      { status: 500 }
    )
  }

  let body: { texts?: string[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { texts } = body
  if (!Array.isArray(texts) || texts.length === 0) {
    return NextResponse.json(
      { error: "texts must be a non-empty string array" },
      { status: 400 }
    )
  }

  if (texts.length > MAX_TEXTS) {
    return NextResponse.json(
      { error: `Too many texts (max ${MAX_TEXTS})` },
      { status: 400 }
    )
  }

  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: texts,
  })

  // OpenAI returns embeddings sorted by index, but we sort explicitly to be safe
  const embeddings = response.data
    .sort((a, b) => a.index - b.index)
    .map((item) => item.embedding)

  return NextResponse.json({ embeddings })
}
