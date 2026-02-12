import { createOpencodeClient } from "@opencode-ai/sdk/v2"

const SERVER_URL = process.env.SWARN_SERVER_URL ?? "http://localhost:4096"
const TIMEOUT_MS = 30000

async function main() {
  const client = createOpencodeClient({ baseUrl: SERVER_URL })
  const directory = process.cwd()

  const session = await client.session.create(
    { directory, title: "opencode-smoke" },
    { headers: { "x-opencode-directory": directory } },
  )

  if (!session.data) {
    throw new Error(`Failed to create session: ${JSON.stringify(session.error)}`)
  }

  const sessionID = session.data.id
  const prompt = client.session.prompt(
    {
      sessionID,
      directory,
      noReply: false,
      parts: [{ type: "text", text: "Reply with exactly: ok" }],
    },
    { headers: { "x-opencode-directory": directory } },
  )

  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error("Timed out waiting for prompt response")), TIMEOUT_MS)
  })

  const result = await Promise.race([prompt, timeout])

  if (!result || !result.data) {
    throw new Error(`Prompt failed: ${JSON.stringify(result?.error)}`)
  }

  const info = result.data.info
  const parts = result.data.parts ?? []
  const text = parts
    .filter((p) => p.type === "text")
    .map((p) => p.text)
    .join("\n")

  console.log("response:", text || "<empty>")
  console.log("tokens:", info.tokens)
  console.log("cost:", info.cost)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
