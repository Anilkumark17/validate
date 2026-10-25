# Assumption Ledger

Declare product assumptions, run customer interviews as live video calls (or import transcripts), and watch each assumption move to validated, invalidated, mixed, or untested, with a verbatim quote behind every status.

Single Next.js app. Route handlers under `src/app/api`, Drizzle ORM on Neon Postgres, LiveKit for video, Gemma 4 through the Gemini API for evidence extraction. The model only classifies evidence. Status is computed by deterministic rules in `src/server/status.ts`.

## Setup

```bash
npm install
cp .env.example .env.local     # then fill in values
npm run db:migrate             # applies drizzle/ migrations to Neon
npm run seed                   # demo project, runs real model analysis
npm run dev                    # http://localhost:3000
```

### Services

1. **Neon**: create a project, copy the pooled connection string into `DATABASE_URL`.
2. **LiveKit Cloud**: create a project, copy URL, API key, and secret into `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`. Set `NEXT_PUBLIC_LIVEKIT_URL` to the same URL.
3. **Gemini API**: create a key at https://aistudio.google.com/apikey and put one or more comma separated keys in `GEMINI_API_KEYS`. Keys rotate round robin with retry on 429 and 5xx. Model IDs are `GEMMA_MODEL_JUDGE` and `GEMMA_MODEL_FAST`.

### Scripts

| Command | Purpose |
| --- | --- |
| `npm run db:generate` | Generate a migration after editing `src/server/db/schema.ts` |
| `npm run db:migrate` | Apply migrations |
| `npm run seed` | Idempotent demo data |
| `npm run llm:check` | Call the vision task once, print JSON and detected JSON mode |
| `npm test` | Unit tests for `computeStatus` |
| `npm run typecheck` | TypeScript check |

## How it works

- A project holds up to 30 assumptions and many meetings. Each meeting has an invite link (`/join/<code>`). Guests enter a name and join the room. The room name is the meeting id.
- Speech to text is a cloud API, not the browser. Each participant's browser records their own mic in 7 second chunks (silent chunks are skipped) and posts them to `/api/meetings/:id/transcribe`, which calls the Gemini API (`STT_MODEL`, default `gemini-3.5-flash-lite`) and stores the text as a segment. Note: this is a Gemini model, not Gemma, so it breaks a strict "Gemma only" rule. Swap `transcribeAudio` in `src/server/llm/tasks.ts` for another provider if needed.
- The analysis prompt (`ANALYZE_SYSTEM`) casts the model as a skeptical senior user researcher: past behavior and numbers are strong evidence, hypotheticals are weak. The Persona tab builds one evidence-based customer persona from all non-rejected evidence, with verbatim quotes only.
- Segments are batched (8 segments or 20 seconds). `analyzeSegments` returns evidence with a verbatim quote. Code drops any item whose quote is not a substring of the segment, and any unknown assumption id.
- The sharing participant's browser captures a screen frame every 20 seconds, uploads it when it differs from the last one, and `describeImage` turns it into image evidence.
- After each batch or link override, statuses are recomputed, `status_event` rows are written, and Server-Sent Events update every open page.
- Events are held in process memory, so run a single server instance (the hackathon scope).

## 3 minute demo

1. **0:00** Create a project (or open the seeded "Meal planning app for busy parents").
2. **0:30** Open Matrix. Point at gap rows, then press "Suggest questions".
3. **1:00** Meetings tab, "Start live call". Copy the invite link, join from a second window.
4. **1:30** Say a supporting line: "Every night I stand in front of the fridge with no idea what to cook." Then a contradicting line from the other window: "We plan all seven dinners on Sunday and stick to it."
5. **2:00** Watch Evidence and Assumptions tabs update. Share a slide with text on it; image evidence appears.
6. **2:30** End call. Review page shows status changes with reasons, evidence accept or reject, token counts, Markdown export.
