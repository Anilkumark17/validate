# Decision log

Short notes on what was decided, why, and what each choice costs. Newest thinking is reflected here, not the order things were tried in.

## Scope

**Decision:** The app does three things: create projects, create meetings (video call with an invite link), and show live transcripts. Everything else was removed: assumptions, evidence, status scoring, matrix, persona, voice, idea mapping, screen-frame analysis, transcript import, review page, and the LLM analysis pipeline.

- **Why:** The product direction narrowed to meetings and transcripts. The removed code had no remaining caller.
- **Trade-off:** Several tables in the database (assumption, evidence, link, fact, status_event) and some npm packages (for example the LangChain ones) are now unused but still present. The schema was deliberately not cleaned up; see "Database".

## Database

**Decision:** Neon Postgres is reached through `@neondatabase/serverless` over WebSocket (port 443) instead of plain `pg` on port 5432.

- **Why:** Port 5432 was blocked on the development network (`ETIMEDOUT`). Port 443 was open.
- **Trade-off:** Each query still costs about 0.28 s of round trip from the development machine, so the number of sequential queries per request matters (see "Latency"). `scripts/migrate.ts` was switched to the same driver.

**Decision:** The schema was left alone except for one migration for authentication (`app_user` table, nullable `project.owner_id`).

- **Why:** The user asked not to touch the schema; auth needs users and ownership, and they approved that single change.
- **Trade-off:** Projects created before auth have no owner and are invisible to everyone until `owner_id` is set by hand. Idempotency and ordering were solved without new columns (see below).

## Authentication and authorization

**Decision:** Own implementation: email and password accounts, scrypt hashing, an HMAC-signed httpOnly session cookie (7 days), no auth library.

- **Why:** Small surface, no new dependency, works with route handlers directly.
- **Trade-off:** No password reset, email verification, or session revocation (a stolen cookie works until it expires). Sign-up is open to anyone. Sign-in and sign-up are rate-limited in memory per process only.

**Decision:** Hosts own projects. Guests join one meeting through its invite code and get a signed guest cookie (24 h) scoped to that meeting.

- **Rules:** Only the project owner can see or change a project and its meetings, and only the owner can end a call. Owner or guest can read a meeting, send transcript lines, and get a LiveKit token. Non-owners get 404 on projects so ids do not leak.
- **Trade-off:** Anyone holding the invite link can join; the link is the secret. There is no per-guest identity beyond the display name they type.

**Decision:** Access checks are done in the API routes. There is no Next.js middleware or proxy.

- **Why:** This Next.js version has breaking changes from older releases, so the less framework surface used, the safer.
- **Trade-off:** Pages guard themselves on the client (redirect to /login). The real protection is the server check on every API call.

## Speech to text: how we got here

The transcription source changed several times. This is the path and the reason for each step.

1. **Gemma/Gemini** (original): replaced at the user's request.
2. **Groq key, `whisper-large-v3-turbo`:** the first key was rejected (401); a later key worked.
3. **GLM ASR (`glm-asr-2512`):** worked, but only accepts wav or mp3 up to 30 s, which forced a browser-side decode and wav re-encode of every chunk.
4. **Groq Whisper with an optimised pipeline:** continuous 16 kHz capture in an AudioWorklet, speech-based chunking, bounded upload queue, rate limiter, retries. Measured on three synthetic clips: pause-based chunking gave the lowest word error rate (2.6%) at about 14 requests/min; fixed 2 s and 3 s chunks had worse accuracy (9 to 10%) and exceeded Groq's 20 requests/min base limit for a single speaker. Groq bills a minimum of 10 s per request, so short chunks also cost more.
5. **Final: browser Web Speech API (current).** No STT API key and no server-side speech cost.

- **Why the final switch:** The user asked for no Groq API and for transcripts to come through LiveKit only. LiveKit has no built-in speech to text without a provider (an agent worker plus an STT service), so the free, simplest option was each participant's browser transcribing its own mic.
- **Trade-offs of the Web Speech API:**
  - Works in Chrome and Edge. Firefox and Safari are not supported; those users are not transcribed.
  - Accuracy varies with browser and accent, and was not measured. Groq Whisper was measured and was better and more consistent.
  - In Chrome the audio is sent to Google's speech service. That is a privacy point for sensitive calls.
  - Speaker labels are supplied by the browser, so the server cannot verify who is speaking.
  - It uses the browser's default microphone, which can differ from the one selected in the call.
- **What would change this decision:** Needing Firefox/Safari support, higher accuracy, or verified speaker identity. The route is already provider-neutral, so a server-side STT (Groq or a LiveKit agent) could feed the same pipeline.

## Transcript delivery

**Decision:** Final phrases are saved by the server first, then broadcast over the LiveKit data channel. Interim (draft) text goes directly between browsers over the data channel, display only, never stored.

- **Why:** Postgres stays the source of truth, a broadcast failure never loses a saved line, and only the server creates transcript rows. Interim text gives fast feedback without writing partial text to the database.
- **Trade-offs:**
  - The LiveKit server call that sends the broadcast takes about 1 s even on an idle connection (measured: about 1.05 s, against 46 ms for an ordinary request to the same host). Other participants therefore see a saved line roughly one to two seconds after it is stored.
  - Sending the final line straight from the speaker's browser would be faster but would let a browser forge transcript lines, so it was not done.
  - The speaker's own screen does not wait for the broadcast; it uses the saved segment returned by the save request.
  - Interim text from other participants is not verified and not persisted.

**Decision:** Server-sent events (SSE) no longer carry transcript lines. SSE stays for meeting updates and meeting end on the meetings list and call page.

- **Why:** A line must not be delivered twice, and the transcript path is LiveKit.
- **Trade-off:** Two realtime channels exist (SSE for lifecycle, LiveKit for content).

**Decision:** Next.js route handlers cannot host WebSockets, so the existing LiveKit connection (a WebSocket) is the transport instead of adding a separate socket server.

- **Trade-off:** Delivery depends on LiveKit being up and on the client holding a LiveKit token, which already gates who can join.

## Correctness and ordering

- **Idempotency without a migration:** each saved line carries a `clientId`; a retried request with the same id returns the first result. The map is in memory, so it is per server process and resets on restart. A retry after a restart, or with several server instances, could create a duplicate.
- **Ordering:** concurrent saves can finish out of order, so the API returns segments ordered by `start_sec` then `idx`, and clients insert new lines in that order. Start times come from each speaker's own clock relative to the meeting start, so small clock differences between participants can reorder lines that are very close together.
- **Late messages:** a line that arrives before the first meeting fetch is held and merged, not dropped. After reconnect or when the tab becomes visible again, the client refetches from the database.

## Latency work (done during the Groq phase, still relevant)

- Access check reduced from three queries to one (session id comes from the signed cookie, owner check joins meeting and project).
- Index assignment and insert combined into one statement, with retry on the existing unique constraint.
- The response to the speaker no longer waits for the LiveKit broadcast. Measured with Groq: server response fell from about 2.4 to 3.0 s to about 0.9 to 1.3 s.
- Only measured on one machine; two-browser end-to-end latency was never measured.

## Things deliberately not done

- No streaming STT claim: Groq Whisper is batch, so it could never be word-by-word; Web Speech gives interim text but is a different trade-off.
- No stored interim text.
- No change to Neon region, connection pooling, or hosting.
- No full removal of unused tables or packages.
- No password reset, email verification, or OAuth.

## Known gaps and risks

- Browser capture, the Web Speech path, and two-browser LiveKit delivery were not tested in a real call. Server routes were tested with `curl`.
- Lint reports errors (refs read during render, setState in effects) in the call page. Some existed before this work; they do not break the build or tests.
- API keys were pasted into chat during development (Gemini, GLM, several Groq keys, LiveKit secret). They should be treated as exposed and rotated.
- The README still describes the original assumption-testing product.
- A 409 on saving a line means the meeting was already ended; a stale browser tab can show this.
