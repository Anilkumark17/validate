# Validate

Create projects, hold video meetings with an invite link, and get a live transcript of everyone who speaks. Transcripts are saved to Postgres and shown to all participants as they happen.

The product started as an assumption-testing tool. That part was removed; what remains is projects, meetings, and live transcripts. See [docs/decision.md](docs/decision.md) for why, and [docs/architecture-diagram.md](docs/architecture-diagram.md) for diagrams of the current code.

## What it does

- **Accounts.** Sign up and sign in with email and password. Each user sees only their own projects.
- **Projects.** A project has a name, an optional description, and an optional target user. It holds meetings.
- **Edit project.** The Edit project button changes name, target user, description and a Context textarea (the same field also exists when creating a project). That textarea is saved as one note titled "Project context".
- **Project context.** The owner adds text notes to a project (title and body, edit and delete): background, goals, what is already known. Text only while the feature is in testing. Stored per project, visible to the owner only, and not used by any other feature yet.
- **Meetings.** Create a meeting (optionally scheduled) or start one straight away. Each meeting has an invite link, `/join/<code>`. Guests enter a name and join without an account.
- **Live video call.** LiveKit provides video and audio. The host can end the call.
- **Live transcripts.** Each participant's speech is transcribed by Sarvam (first choice). If Sarvam is not configured or keeps failing, that participant's browser switches to the Web Speech API and tries Sarvam again after two minutes. Finished phrases are saved, then shown to everyone in time order. Draft text appears in italics in browser-speech mode. After a call ends, the saved transcript stays readable.

## Tech stack

Next.js 16 (App Router, route handlers), React 19, TypeScript, Tailwind 4, TanStack Query, Drizzle ORM, Neon Postgres (over WebSocket), LiveKit (video, audio, data channel), Zod, Vitest.

## How the pieces connect

```
Browser (Next.js client)
  |  HTTPS: pages and /api routes
  |  SSE:   meeting updated / ended
  |  WebSocket (LiveKit): video, audio, transcript messages
  v
Next.js server --- Neon Postgres (app_user, project, meeting, segment)
  |
  +--- LiveKit Cloud (token issue, transcript broadcast)
```

Transcript path in short: the speaker's browser captures audio, cuts it at pauses and uploads it to `POST /api/meetings/<id>/transcribe`; the server calls Sarvam, saves the row, and broadcasts it over the LiveKit data channel (topic `transcript`). In fallback mode the browser recognizes the phrase itself and posts text to `POST /api/meetings/<id>/segments`, which saves and broadcasts the same way. Every client merges lines by id and sorts by start time. Drafts (fallback mode only) go directly between browsers (topic `interim`) and are never stored. Reloads and reconnects refetch the saved transcript from the database. Full diagrams are in [docs/architecture-diagram.md](docs/architecture-diagram.md).

## Access rules

| Who | Can do |
| --- | --- |
| Signed-out visitor | Is redirected to `/login` from the app pages, can view an invite page (`/join/<code>`), join a meeting with the invite code |
| Host (project owner) | Everything on own projects and their meetings, including ending a call |
| Guest (joined by invite link) | Read that one meeting, send transcript lines, join its call. Cannot see the project or end the call. Access lasts 24 hours |
| Other signed-in user | No access to someone else's project or meeting (projects return 404) |

## Setup

### Requirements

- Node.js 20 or newer
- A Postgres database (the project uses Neon)
- A LiveKit Cloud project (URL, API key, API secret)
- A Sarvam API key for speech to text. Without it everyone uses browser speech recognition, which needs Chrome or Edge (other browsers can join and watch but are not transcribed).

### Environment

Copy `.env.example` to `.env.local` and fill in:

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres connection string. Neon pooled string works |
| `AUTH_SECRET` | yes | Random string of at least 32 characters. Signs session and guest cookies |
| `SARVAM_API` | no | Sarvam speech to text key. Empty means browser speech recognition only |
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

Other scripts:

| Command | What it does |
| --- | --- |
| `npm run build` / `npm start` | Production build and server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit tests |
| `npm run lint` | ESLint |
| `npm run db:generate` | Generate a migration after editing `src/server/db/schema.ts` |

If your network blocks Postgres port 5432, no change is needed: the app and the migrate script connect to Neon over port 443 (WebSocket).

## Using it

1. Open the app, create an account, and create a project. Use the Context tab to add background text about it.
2. In the project, create a meeting, or choose "Start live call" to create and join immediately.
3. Copy the invite link and send it to guests.
4. Allow the microphone and speak. A badge on the video shows "Transcribing: Sarvam" or "browser speech (fallback)".
5. The host ends the call. Everyone returns to the meetings list (guests to the join page). Open "Transcript" on an ended meeting to read it.

Add `?debug=1` to a call URL to see a small end-to-end latency readout.

## API

All routes are under `/api`. JSON in and out.

| Route | Methods | Access |
| --- | --- | --- |
| `/auth/signup`, `/auth/login` | POST | Public, rate limited |
| `/auth/logout` | POST | Any |
| `/auth/me` | GET | Signed in |
| `/projects` | GET, POST | Signed in (own projects) |
| `/projects/<id>` | GET, PATCH, DELETE | Owner. GET and PATCH include `context`; PATCH edits name, description, target user and the main context note |
| `/projects/<id>/meetings` | GET, POST | Owner |
| `/projects/<id>/context` | GET, POST | Owner. POST body: `title` (max 120), `content` (max 20,000 characters). Up to 50 entries per project |
| `/projects/<id>/context/<contextId>` | PATCH, DELETE | Owner |
| `/projects/<id>/events` | GET (SSE) | Owner, or guest of a meeting in the project |
| `/meetings/by-code/<code>` | GET | Public (title and project name only) |
| `/livekit/token` | POST | Invite code (public, sets guest cookie) or meeting id (host or guest) |
| `/meetings/<id>` | GET | Host or guest (meeting and ordered segments) |
| `/meetings/<id>/start` | POST | Host or guest |
| `/meetings/<id>/transcribe` | POST | Host or guest. Multipart wav chunk (`audio`, `speaker`, `clientId`, `startSec`, `capturedAt`). Sarvam speech to text. Failure code `stt_unavailable` tells the client to fall back |
| `/meetings/<id>/segments` | POST | Host or guest. JSON text from browser speech (fallback). Body: `speaker`, `text`, `startSec`, `capturedAt`, `clientId` |
| `/meetings/<id>/end` | POST | Host only |
| `/health` | GET | Public, checks the database |

Errors use `{ "error": { "code", "message" } }`. A `409 ended` means the meeting was already ended.

## Project layout

```
src/
  app/
    page.tsx                         project list and create
    login/page.tsx                   sign in / sign up
    join/[code]/page.tsx             guest join page
    p/[projectId]/page.tsx           redirects to meetings
    p/[projectId]/meetings/page.tsx  meetings list, create, invite link
    p/[projectId]/context/page.tsx   project context notes (add, edit, delete)
    m/[meetingId]/call/page.tsx      video call, transcriber, live transcript
    api/                             route handlers (see API table)
  components/                        app shell, project header, meeting dialogs, ui primitives
  lib/
    api.ts                           fetch wrapper and types
    auth.tsx                         useMe, RequireAuth
    schemas.ts                       Zod input schemas
    transcript.ts                    ordered, deduplicated segment insert
    use-project-events.ts            SSE hook
    audio/                           wav encoder, pause-based chunking, upload queue, latency window
  server/
    auth.ts                          password hashing, signed cookies, access checks
    db/                              Drizzle client (Neon over WebSocket) and schema
    env.ts                           validated environment
    http.ts                          ApiError, handle(), parseBody, rate limit
    livekit.ts                       broadcast saved segments over LiveKit
    queries.ts                       project and meeting lookups
    segments.ts                      insert one segment
    stt.ts                           Sarvam speech to text with retries
    segment-dedupe.ts                in-memory duplicate protection
    sse.ts                           project event stream
drizzle/                             SQL migrations
scripts/migrate.ts                   applies migrations
docs/                                decision log and architecture diagrams
```

## Known limitations

- **Fallback mode.** Browser speech recognition works in Chrome and Edge only, accuracy varies, and in Chrome audio goes to Google's speech service. A chunk that fails its last Sarvam retry is lost; the switch covers speech from then on.
- **Sarvam cost and limits** were not verified. Check your plan.
- **Delivery delay.** A saved line reaches other participants about one to two seconds after it is stored, because the LiveKit server call takes about a second.
- **Speaker names** come from the browser and are not verified.
- **Duplicate protection is per process.** After a server restart, or with several server instances, a retried request could create a duplicate line.
- **Auth is minimal.** No password reset, email verification, or session revocation. Sign-up is open.
- **Old data.** Projects created before accounts existed have no owner and are not visible until `owner_id` is set in the database.
- **Context is text only** and nothing reads it yet (not shown in calls, not used for transcription). No file upload, search, or sharing with guests.
- **Unused data.** Tables from the earlier product (`assumption`, `evidence`, `link`, `fact`, `status_event`) and some npm packages remain but nothing uses them.
- **Untested in a real call.** Server routes are tested with `curl` and unit tests. Browser audio capture, the automatic Sarvam to browser switch, and two-browser delivery have not been verified end to end.
