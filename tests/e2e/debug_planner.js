import { createOpencodeClient } from "@opencode-ai/sdk/v2"

const SERVER_URL = process.env.SWARN_SERVER_URL ?? "http://localhost:4096"
const directory = process.cwd()

async function main() {
  const client = createOpencodeClient({ baseUrl: SERVER_URL })

  // Step 1: Health check
  console.log(`[${ts()}] Connecting to ${SERVER_URL}...`)
  const sessions = await client.session.list({})
  console.log(`[${ts()}] Health OK — ${sessions.data?.length ?? 0} existing sessions`)

  // Step 2: Create session
  console.log(`[${ts()}] Creating session...`)
  const session = await client.session.create(
    { directory, title: "debug-planner" },
    { headers: { "x-opencode-directory": directory } },
  )
  if (!session.data) {
    throw new Error(`Failed to create session: ${JSON.stringify(session.error)}`)
  }
  const sessionID = session.data.id
  console.log(`[${ts()}] Session created: ${sessionID}`)

  // Step 3: Simple prompt first (baseline)
  console.log(`\n[${ts()}] === Test 1: Simple prompt ===`)
  const t1 = Date.now()
  const simple = await client.session.prompt(
    {
      sessionID,
      directory,
      noReply: false,
      parts: [{ type: "text", text: 'Reply with exactly: {"status":"ok"}' }],
    },
    { headers: { "x-opencode-directory": directory } },
  )
  const elapsed1 = ((Date.now() - t1) / 1000).toFixed(1)
  const text1 = (simple.data?.parts ?? [])
    .filter((p) => p.type === "text")
    .map((p) => p.text)
    .join("\n")
  console.log(`[${ts()}] Simple prompt response in ${elapsed1}s: ${text1.slice(0, 200) || "<empty>"}`)

  // Step 4: Planner-like prompt (minimal — no codebase exploration)
  console.log(`\n[${ts()}] === Test 2: Minimal planner prompt (no exploration) ===`)
  const t2 = Date.now()
  const minimal = await client.session.prompt(
    {
      sessionID,
      directory,
      noReply: false,
      parts: [{
        type: "text",
        text: `Output exactly this JSON array, nothing else:
\`\`\`json
[{"id":"T-01","title":"Add --name flag","description":"Add a --name CLI flag to src/index.ts","filePaths":["src/index.ts"],"dependencies":[]}]
\`\`\``
      }],
    },
    { headers: { "x-opencode-directory": directory } },
  )
  const elapsed2 = ((Date.now() - t2) / 1000).toFixed(1)
  const text2 = (minimal.data?.parts ?? [])
    .filter((p) => p.type === "text")
    .map((p) => p.text)
    .join("\n")
  console.log(`[${ts()}] Minimal planner response in ${elapsed2}s: ${text2.slice(0, 500) || "<empty>"}`)

  // Step 5: Full planner prompt (with exploration)
  console.log(`\n[${ts()}] === Test 3: Full planner prompt (with codebase exploration) ===`)
  const t3 = Date.now()
  const full = await client.session.prompt(
    {
      sessionID,
      directory,
      noReply: false,
      parts: [{
        type: "text",
        text: `You are a senior software architect. Read the user request below and produce a plan as a JSON array.

## User Request
Add support for an optional --name and --excited CLI flag in the greeting app.

## Output Format
Output a JSON array in a \`\`\`json code block. Each task: id (T-XX), title, description, filePaths, dependencies.
Explore the codebase first to understand the structure.`
      }],
    },
    { headers: { "x-opencode-directory": directory } },
  )
  const elapsed3 = ((Date.now() - t3) / 1000).toFixed(1)
  const text3 = (full.data?.parts ?? [])
    .filter((p) => p.type === "text")
    .map((p) => p.text)
    .join("\n")
  console.log(`[${ts()}] Full planner response in ${elapsed3}s: ${text3.slice(0, 500) || "<empty>"}`)

  // Cleanup
  await client.session.delete(
    { sessionID, directory },
    { headers: { "x-opencode-directory": directory } },
  )
  console.log(`\n[${ts()}] Session destroyed. Done.`)
}

function ts() {
  return new Date().toISOString().slice(11, 23)
}

main().catch((err) => {
  console.error("FATAL:", err instanceof Error ? err.message : String(err))
  process.exit(1)
})
