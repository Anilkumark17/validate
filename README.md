# Validate

Validate helps a founder or product manager test a product idea before building it. You describe the idea, the app proposes the riskiest assumptions and the stakeholder roles worth interviewing, and you track each assumption on a board until real evidence validates or invalidates it. You can hold the research interviews inside the app: video meetings with an invite link and a live, saved transcript.

Two ideas drive the design:

1. **The model proposes, a person decides.** AI generates assumptions, stakeholders and interview guides. It never records evidence and never changes an assumption's status. Those are human actions, enforced on the server.
2. **Postgres is the source of truth.** Every rule that matters (status transitions, risk score, de-duplication, ownership) is enforced by the server or the database, not only by the UI.

Related docs: [docs/decision.md](docs/decision.md) (decision log), [docs/architecture-diagram.md](docs/architecture-diagram.md) (diagrams), [docs/SystemPrompts/rightQuestions.md](docs/SystemPrompts/rightQuestions.md) (interview coaching prompt).

## Features

### Accounts and projects
- Email and password accounts. Each user sees only their own projects.
- A project has a name, a description (the idea), an optional target user, and free-text **context notes** (background, goals, what is already known). Notes feed the AI prompts.
- Audience handling: the app checks whether the idea names its audience. If it does, that is stored as `detected`. If not, the user answers one question (with AI suggestions), or skips. A skipped audience marks the generated assumptions `provisional` instead of inventing a customer.

### Assumption generation
- One click generates 6 to 10 risky, distinct assumptions and 3 to 5 stakeholder roles, linked many to many.
- Each assumption carries a category (for example problem severity, willingness to pay), impact and uncertainty (1 to 5), a rationale, a validation method, validation questions, an experiment, and a success criterion.
- **Refine**: the user adds context along chosen dimensions and the model returns only new assumptions and roles. Suggested rewording of existing assumptions and "possibly obsolete" flags are stored for the user to review and are never applied automatically.
- Generation is asynchronous: the API returns `202`, the work continues on the server, and the client polls.

### Validation board
- Kanban board with seven statuses: Generated, Ready to Validate, Validation in Progress, Evidence Collected, Validated, Invalidated, Needs More Evidence. Drag and drop with `@dnd-kit`.
- Risk is `impact x uncertainty` (1 to 25), bucketed high (15+), medium (8 to 14), low. Search, filter and sort by risk, status, category, stakeholder and method.
- Progress is `(validated + invalidated) / total`, derived from status counts every time and never stored.
- Users can add, edit and delete their own assumptions and stakeholders, and re-link them.

### Evidence and decisions
- Evidence is recorded by a person: type (interview, survey, prototype test, experiment, analytics, observation, secondary research), summary, source, interpretation (supports, contradicts, inconclusive), strength, date, optional link to a meeting.
- Closing an assumption as Validated or Invalidated requires selected evidence, a written interpretation, a rationale, and an explicit confirmation. Validated needs at least one supporting item and Invalidated at least one contradicting item. Otherwise the server recommends Needs More Evidence.
- Every move is written to an append-only **decision log** (`assumption_decision`) in the same transaction as the status change.
- Stakeholder coverage: a role with linked assumptions and fewer than 5 interviews is flagged.

### Question bank
- Generates a five act interview guide for one stakeholder from its riskiest linked assumptions (max 4), based on the Mom-Test style coaching prompt in [docs/SystemPrompts/rightQuestions.md](docs/SystemPrompts/rightQuestions.md): welcome and consent, context, core deep dive, wrap-up, unknown unknowns.
- Questions are about past behavior and specific stories. Hypothetical and leading questions are rejected by validation (see below).

### Meetings and live transcripts
- Create a meeting (optionally scheduled) or start one immediately. Each has an invite link, `/join/<code>`. Guests enter a name and join without an account.
- LiveKit provides video and audio. The host can end the call.
- Every participant's speech is transcribed by Sarvam first. If Sarvam is not configured or keeps failing, that participant's browser switches to the Web Speech API and retries Sarvam after two minutes. Finished phrases are saved, then shown to everyone in time order. Saved transcripts stay readable after the call.

### Landing page
- Public marketing page at `/` with animated board preview, features, pricing and FAQ.

## Tech stack

Next.js 16 (App Router, route handlers), React 19, TypeScript, Tailwind 4, TanStack Query, Radix UI, `@dnd-kit`, Drizzle ORM, Neon Postgres (over WebSocket), LiveKit, Sarvam (speech to text), GLM / Zhipu (generation), Zod, Vitest.

## Engineering decisions

The full log with trade-offs is in [docs/decision.md](docs/decision.md). The ones that shape the code:

### Rules live in one pure module, enforced on the server
Status transitions are a table (`ALLOWED`) and a function (`checkMove`) in [src/lib/board/transitions.ts](src/lib/board/transitions.ts), shared by client and server. The move route [src/app/api/projects/[id]/assumptions/[aid]/move/route.ts](src/app/api/projects/[id]/assumptions/[aid]/move/route.ts) runs it for every request, so a client that bypasses the UI gets the same rules. The assumption row is locked with `FOR UPDATE`, the client's expected current status is compared (`409 status_changed` on a stale board), and the decision record is inserted in the same transaction. Because the rules are pure functions, they are unit tested without a database.

### The database protects its own invariants
- `risk` is a generated column (`impact * uncertainty`), so it cannot disagree with its inputs.
- Check constraints bound impact, uncertainty, relevance (1 to 5) and confidence (0 to 100).
- Composite foreign keys `(id, project_id)` force an assumption, stakeholder, evidence row or decision to belong to the same project as what it links to, so cross-project links are impossible even through a bug.
- Unique `dedupe_key` per project for assumptions and stakeholders.
- Decisions are append-only: the app exposes no update or delete.

### Treating LLM output as untrusted input
[src/server/board/glm.ts](src/server/board/glm.ts) and [src/lib/board/schemas.ts](src/lib/board/schemas.ts):
- JSON mode, then Zod validation of the whole reply. On failure the model is re-asked with the exact validation errors, a bounded number of times (default 2 retries).
- The schemas encode product rules, not just types: scores in range, unique ids and titles, links must reference known ids, every assumption must be linked, categories must be snake_case.
- `isLeadingQuestion` rejects hypothetical, opinion-seeking and leading questions ("Would you use...", "Don't you think..."). The guide schema requires exactly five acts in order, no hypotheticals in acts 2 and 3, and at least two core questions per assumption (triangulation).
- `looksLikeFabricatedEvidence` rejects invented statistics and research claims ("73% of users...", "studies show...").
- Model output is only parsed, never executed. Owner notes are fenced in tags inside the prompt as data. Error messages never contain the API key.
- Transient HTTP failures (429, 5xx) retry with backoff and `Retry-After`; permanent 4xx fail fast; repeated failures fall back to a second model (`GLM_MODEL_FALLBACK`).

### Idempotent, restart-safe generation
`generation_run` records every attempt with an idempotency key (unique per project). A double click, a retry, or a second tab returns the existing run. Only one run per project is active; a completed initial run is returned instead of regenerating. Runs stuck for over 6 minutes (server restart) are closed as failed so retry works. Writes happen in one transaction with `ON CONFLICT DO NOTHING` on the dedupe keys, plus a Jaccard word-similarity check (threshold 0.8) so reworded repeats of an existing assumption are skipped. An existing user-edited stakeholder is kept untouched and linked to, never overwritten. The run stores model, examples used, attempts, and created and skipped counts.

### Prompt design
Prompts have fixed sections: project, owner context, examples, existing items (so they are not repeated), refinement, output schema, task. Few-shot examples are chosen deterministically by keyword match from three domains, and the prompt states they show structure only and are not research about this project's customers. They are tested to satisfy the production schema, so examples cannot drift from validation.

### Honest about the audience
The model is told not to invent a target customer. An unconfirmed audience becomes `provisional` on assumptions instead of a fabricated persona.

### Own auth, no auth library, no middleware
scrypt password hashing and an HMAC-signed httpOnly session cookie (7 days). Guests get a separate signed cookie (24 h) scoped to one meeting. Access checks run in each route handler (`requireProject`). Non-owners get `404` on projects so ids do not leak. Trade-off: no password reset, email verification or session revocation. Pages redirect on the client; the server check is the real protection. This Next.js version has breaking changes, so the app uses as little framework surface as possible.

### Database over port 443
Neon is reached with `@neondatabase/serverless` over WebSocket because port 5432 was blocked on the dev network. Because each query costs a round trip, hot paths were cut down: the access check is one query, and segment index assignment plus insert is one statement with retry on the unique constraint.

### Speech to text: server first, browser as safety net
Path taken: Gemini, Groq Whisper (measured: pause-based chunking gave 2.6% word error rate against 9 to 10% for fixed chunks), GLM ASR, browser only, and finally Sarvam with browser fallback. The browser captures 16 kHz audio in an AudioWorklet, cuts at pauses (2 to 8 s), and sends chunks through a bounded upload queue that retries with the same id and merges rather than drops audio when backed up. Fatal Sarvam errors (no key, 4xx) switch that speaker to browser speech at once; two consecutive failures do too.

### Transcript delivery
The server saves a line first, then broadcasts it on the LiveKit data channel (topic `transcript`). Postgres stays the source of truth and a failed broadcast never loses a saved line. The speaker's own screen uses the response of the save, not the broadcast. Draft text goes browser to browser (topic `interim`) and is never stored. SSE carries only meeting lifecycle (updated, ended). Sending finals directly from the browser would be faster but would let a client forge transcript lines.

### Correctness and ordering
Retries with the same `clientId` return the first result (in memory, per process). Concurrent saves can finish out of order, so segments are ordered by `start_sec` then `idx`, and clients insert in that order and merge by id. A line that arrives before the first fetch is held, not dropped. Reconnect refetches from the database.

### Schema evolution
Eight Drizzle migrations (0005 dropped the old assumption-tool tables and rebuilt them for the board) in [drizzle/](drizzle/). The `category` column is free text so the category list can grow without a migration. Enums are used where the set is closed (status, evidence type, interpretation).

## How the pieces connect

```
Browser (Next.js client)
  |  HTTPS: pages and /api routes
  |  SSE:   meeting updated / ended
  |  WebSocket (LiveKit): video, audio, transcript messages
  v
Next.js server --- Neon Postgres
  |
  +--- LiveKit Cloud   (token issue, transcript broadcast)
  +--- Sarvam          (speech to text)
  +--- GLM             (assumptions, stakeholders, interview guides)
```

Generation path: `POST /generate` creates a `generation_run` and returns `202`. The server builds the prompt, calls GLM, validates the reply, and persists everything in one transaction. The client polls `GET /generation`.

Transcript path: the speaker's browser cuts audio at pauses and uploads it to `POST /api/meetings/<id>/transcribe`. The server calls Sarvam, saves the row, and broadcasts it. In fallback mode the browser posts recognized text to `/segments` instead. Full diagrams are in [docs/architecture-diagram.md](docs/architecture-diagram.md).

## Access rules

| Who | Can do |
| --- | --- |
| Signed-out visitor | See the landing page, view an invite page, join a meeting with the invite code. App pages redirect to `/login` |
| Host (project owner) | Everything on own projects: board, evidence, decisions, stakeholders, guides, context, meetings, ending a call |
| Guest (joined by invite link) | Read that one meeting, send transcript lines, join its call. Cannot see the project. Access lasts 24 hours |
| Other signed-in user | No access to someone else's project (404) |

## Setup

### Requirements

- Node.js 20 or newer
- A Postgres database (the project uses Neon)
- A LiveKit Cloud project (URL, API key, API secret)
- A GLM (Zhipu) API key for generation. Without it the board works manually but generation fails with a clear error
- A Sarvam API key for speech to text. Without it everyone uses browser speech recognition (Chrome or Edge)

### Environment

Copy `.env.example` to `.env.local` and fill in:

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres connection string. Neon pooled string works |
| `AUTH_SECRET` | yes | Random string of at least 32 characters. Signs session and guest cookies |
| `GLM_API` | for generation | Zhipu GLM key. Server side only |
| `GLM_MODEL` | no | Default `glm-4.6` |
| `GLM_MODEL_FALLBACK` | no | Default `glm-4.5-flash`, used when the main model keeps failing |
| `GLM_BASE_URL` | no | Default `https://open.bigmodel.cn/api/paas/v4` |
| `SARVAM_API` | no | Empty means browser speech recognition only |
| `SARVAM_MODEL` | no | Default `saaras:v4` |
| `SARVAM_LANGUAGE` | no | `unknown` (auto-detect, default) or a code like `en-IN` |
| `LIVEKIT_URL` | yes | `wss://<project>.livekit.cloud` |
| `LIVEKIT_API_KEY` | yes | LiveKit API key |
| `LIVEKIT_API_SECRET` | yes | LiveKit API secret |
| `NEXT_PUBLIC_LIVEKIT_URL` | yes | Same as `LIVEKIT_URL`, exposed to the browser |

Generate a secret with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

### Run

```bash
npm install
npm run db:migrate     # applies the SQL in ./drizzle
npm run dev            # http://localhost:3000
```

| Command | What it does |
| --- | --- |
| `npm run build` / `npm start` | Production build and server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit tests |
| `npm run lint` | ESLint |
| `npm run db:generate` | Generate a migration after editing `src/server/db/schema.ts` |

## Using it

1. Sign up and create a project. Describe the idea and add context notes.
2. Confirm the audience (or skip), then generate assumptions and stakeholders.
3. On the Board, review assumptions, edit them, and drag the ones you will test to Ready to Validate.
4. Generate an interview guide for a stakeholder from the Questions page.
5. Create a meeting, share the invite link, hold the interview, and read the transcript.
6. Record evidence on the assumption. Move it to Evidence Collected, then close it as Validated or Invalidated with a rationale. Every decision appears on the Decisions page.

Add `?debug=1` to a call URL to see an end-to-end latency readout.

## API

All routes are under `/api`. JSON in and out. Errors use `{ "error": { "code", "message" } }`. All project routes require the owner.

| Route | Methods | Notes |
| --- | --- | --- |
| `/auth/signup`, `/auth/login` | POST | Public, rate limited |
| `/auth/logout`, `/auth/me` | POST, GET | |
| `/projects` | GET, POST | Own projects |
| `/projects/<id>` | GET, PATCH, DELETE | PATCH edits name, description, target user, main context note |
| `/projects/<id>/context`, `/context/<contextId>` | GET, POST, PATCH, DELETE | Title max 120, body max 20,000, 50 per project |
| `/projects/<id>/audience` | PUT | Save the confirmed or skipped audience |
| `/projects/<id>/audience/analyze` | POST | Detect audience in the idea, or suggest options |
| `/projects/<id>/generate` | POST | Start or retry first generation. `202`, idempotent |
| `/projects/<id>/generation` | GET | Latest run status (poll) |
| `/projects/<id>/refine` | POST | Add context, get new assumptions and suggestions |
| `/projects/<id>/board` | GET | Assumptions, stakeholders, progress |
| `/projects/<id>/assumptions` | POST | Add a user-created assumption |
| `/projects/<id>/assumptions/<aid>` | GET, PATCH, DELETE | |
| `/projects/<id>/assumptions/<aid>/move` | POST | The only way status changes. Rules enforced here |
| `/projects/<id>/assumptions/<aid>/evidence` | POST | Human-recorded evidence |
| `/projects/<id>/assumptions/<aid>/evidence/<eid>` | DELETE | |
| `/projects/<id>/assumptions/<aid>/stakeholders` | PUT | Replace linked stakeholders |
| `/projects/<id>/stakeholders` | POST | |
| `/projects/<id>/stakeholders/<sid>` | PATCH, DELETE | |
| `/projects/<id>/stakeholders/<sid>/assumptions` | PUT | Replace linked assumptions |
| `/projects/<id>/evidence`, `/decisions` | GET | Project-wide lists |
| `/projects/<id>/guides` | GET, POST | Five act interview guide per stakeholder |
| `/projects/<id>/guides/<gid>` | DELETE | |
| `/projects/<id>/meetings` | GET, POST | |
| `/projects/<id>/events` | GET (SSE) | Owner or guest of a meeting in the project |
| `/meetings/by-code/<code>` | GET | Public (title and project name only) |
| `/livekit/token` | POST | Invite code (sets guest cookie) or meeting id |
| `/meetings/<id>` | GET | Host or guest, with ordered segments |
| `/meetings/<id>/start`, `/end` | POST | Start: host or guest. End: host only |
| `/meetings/<id>/transcribe` | POST | Multipart wav chunk to Sarvam. `stt_unavailable` tells the client to fall back |
| `/meetings/<id>/segments` | POST | Browser speech text (fallback) |
| `/health` | GET | Checks the database |

Rate limits (per process) apply to auth, generation, refine, audience, guides, move, transcribe and segments.

## Project layout

```
src/
  app/
    page.tsx, projects/page.tsx         landing, project list
    login/, join/[code]/                auth, guest join
    p/[projectId]/                      setup, board, stakeholders, questions,
                                        evidence, decisions, context, meetings
    m/[meetingId]/call/page.tsx         video call and live transcript
    api/                                route handlers
  components/                           app shell, board dialogs, landing, ui primitives
  lib/
    board/                              constants, transitions, schemas (Zod), filters, client
    audio/                              wav encoder, endpointer, upload queue, metrics
    api.ts, auth.tsx, schemas.ts, transcript.ts, use-project-events.ts
  server/
    board/                              generate (runs), glm client, prompts, examples, queries
    db/                                 Drizzle client and schema
    auth.ts, env.ts, http.ts            sessions and access, validated env, handle/rateLimit
    stt.ts, livekit.ts, sse.ts          Sarvam, broadcast, event stream
    segments.ts, segment-dedupe.ts      transcript save and duplicate protection
drizzle/                                SQL migrations
scripts/migrate.ts                      applies migrations
docs/                                   decision log, diagrams, system prompts
```

## Testing

`npm test` runs Vitest unit tests (no database or network needed):

- **Board rules:** risk and progress formulas, every status transition, evidence and rationale requirements, filters and sorting, duplicate detection.
- **Output guards:** leading-question and fabricated-statistic detectors, generation and interview guide schemas.
- **Prompts and examples:** section order, example selection, every example satisfies the production schema, owner text fenced as data.
- **GLM client:** retry on transient errors, no retry on permanent errors, model fallback, re-ask on malformed JSON, bounded attempts, key never leaked (fetch and sleep are injected).
- **Audio:** WAV header, pause-based chunking loses no audio, upload queue ordering and retry, ordered segment insert.

## Known limitations

- **No end-to-end tests.** API routes and the database layer are verified by hand; there are no integration or browser tests.
- **In-memory state is per process:** rate limits, transcript idempotency and the "active run" set. With several instances or after a restart, a retry could duplicate a transcript line or exceed a limit. Generation de-duplication is in the database and is safe.
- **Generation runs in the web process** (fire and forget, then poll). A restart mid-run loses it; it is marked failed after 6 minutes and can be retried. A real job queue would be the next step.
- **Fallback speech mode** needs Chrome or Edge, and in Chrome audio goes to Google. A chunk that fails its last Sarvam retry is lost.
- **Delivery delay:** transcript lines reach others about one to two seconds after saving, because the LiveKit server call takes about a second.
- **Speaker names** come from the browser and are not verified. Sarvam gives no diarization here.
- **Auth is minimal:** no password reset, email verification, session revocation, or OAuth. Sign-up is open.
- **Model quality is not guaranteed.** Validation catches structure, leading questions and invented statistics, but not whether an assumption is actually insightful.
- **Context is text only,** no files or sharing with guests.
- **Unused leftovers** from earlier versions remain: some columns (`persona`, `voice`, meeting job and token counters) and some npm packages (LangChain).
- **Old data:** projects created before accounts existed have no owner and are invisible until `owner_id` is set.
- **Sarvam cost and rate limits** were not verified.
