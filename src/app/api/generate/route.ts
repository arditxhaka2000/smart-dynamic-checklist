import { NextResponse } from "next/server"

type GeminiRequestBody = {
  apikey: string
  prompt: string
  existing: string[]
}

export async function POST(req: Request) {
  const body = (await req.json()) as GeminiRequestBody
  const { apikey, prompt, existing } = body

  if (!apikey) {
    return NextResponse.json({ error: "Missing API key" }, { status: 400 })
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apikey}`;


  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: [
                "You are helping an implementation consultant create a concise onboarding checklist.",
                "Return 5-8 bullet points, each describing a single actionable step.",
                "Do not number them, just bullets. Prefer accounting/ERP-style phrasing when relevant.",
                "",
                "User prompt:",
                prompt
              ].join("\n")
            }
          ]
        }
      ]
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    return NextResponse.json({ error: errorText || "Gemini error" }, { status: response.status })
  }

  const json = await response.json()

  const rawText: string =
    json?.candidates?.[0]?.content?.parts?.[0]?.text ?? ""

  const lines = rawText
    .split(/\r?\n/)
    .map((line: string) => line.replace(/^[-*•]\s*/, "").trim())
    .filter((line: string) => line.length > 0)

  const unique = Array.from(
    new Set(
      lines.map((l: string) => l.replace(/^\d+\.\s*/, "").trim())
    )
  )

  const filtered = unique.filter((item: string) => !existing.includes(item))

  const items = filtered.slice(0, 8)

  return NextResponse.json({ items })
}
