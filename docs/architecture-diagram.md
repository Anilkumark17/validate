# Architecture diagrams

Current code: projects, meetings (LiveKit video call with invite link), and live transcripts. Diagrams are Mermaid and render on GitHub and in most editors.

## 1. System overview

```mermaid
flowchart LR
    subgraph Browser["Browser (Next.js client)"]
        Pages["Pages<br/>/ , /login , /join/code<br/>/p/id/meetings , /m/id/call"]
        Capture["Audio capture<br/>16 kHz, pause-based chunks, upload queue"]
        Speech["Web Speech API<br/>fallback only"]
        LKClient["livekit-client<br/>video, audio, data channel"]
        Cache["TanStack Query cache<br/>meeting + segments"]
    end

    subgraph Next["Next.js server (route handlers)"]
        Auth["server/auth.ts<br/>session + guest cookies"]
        API["API routes<br/>/api/auth, projects, meetings, livekit/token"]
        TrRoute["POST /api/meetings/id/transcribe"]
        Sarvam["server/stt.ts<br/>Sarvam speech to text"]
        SegRoute["POST /api/meetings/id/segments<br/>text from fallback"]
        SSE["server/sse.ts<br/>in-memory event hub"]
        LKServer["server/livekit.ts<br/>RoomServiceClient.sendData"]
        Dedupe["segment-dedupe.ts<br/>clientId TTL map"]
    end

    DB[("Neon Postgres<br/>app_user, project, meeting, segment")]
    LKCloud["LiveKit Cloud<br/>room = meeting id"]

    Pages --> API
    Pages -->|"EventSource"| SSE
    Capture -->|"wav chunk"| TrRoute
    TrRoute --> Sarvam
    Sarvam -->|"HTTPS"| SarvamCloud["Sarvam API"]
    TrRoute --> Auth
    TrRoute --> Dedupe
    TrRoute -->|"insert, then broadcast"| DB
    TrRoute --> LKServer
    Capture -.->|"Sarvam failed twice or not configured"| Speech
    Speech --> SegRoute
    Speech -->|"interim text"| LKClient
    LKClient <-->|"WebSocket"| LKCloud
    LKClient --> Cache

    API --> Auth
    SegRoute --> Auth
    SegRoute --> Dedupe
    API --> DB
    SegRoute -->|"1 insert"| DB
    SegRoute -->|"2 broadcast"| LKServer
    LKServer -->|"HTTPS, topic transcript"| LKCloud
    API -->|"meeting.updated / ended"| SSE
    DB -.->|"driver: @neondatabase/serverless over port 443"| API
```

## 2. Live transcript flow

Primary path: Sarvam. Final lines are saved first, then broadcast.

```mermaid
sequenceDiagram
    autonumber
    participant A as Browser A (speaker)
    participant S as Next.js server
    participant SV as Sarvam API
    participant DB as Postgres
    participant LK as LiveKit room (WebSocket)
    participant B as Browser B (other participant)

    A->>A: AudioWorklet captures 16 kHz PCM, cut at pauses (2 to 8 s)
    A->>S: POST /api/meetings/id/transcribe (wav, clientId)
    S->>S: requireMeetingAccess (1 query), validate wav
    S->>SV: POST /speech-to-text (saaras:v4, language unknown)
    SV-->>S: transcript
    S->>DB: INSERT segment (idx from subselect)
    S-->>A: 201 {segment}
    S->>LK: sendData topic transcript (not awaited by the response)
    LK-->>A: DataReceived (deduped by segment id)
    LK-->>B: DataReceived
    Note over B: insert in start-time order

    rect rgb(255,245,230)
    Note over A,S: Fallback when Sarvam is not configured, rejects the key, or fails twice in a row
    SV--xS: error
    S-->>A: 503 stt_unavailable
    A->>A: switch to Web Speech API for 2 minutes, then retry Sarvam
    A->>LK: interim text (topic interim, display only)
    A->>S: POST /api/meetings/id/segments (final text, clientId)
    S->>DB: INSERT segment
    S->>LK: sendData topic transcript
    end

    rect rgb(240,240,240)
    Note over B,S: Reload or reconnect
    B->>S: GET /api/meetings/id
    S->>DB: segments ordered by start_sec, idx
    S-->>B: full history, then live messages continue
    end
```

## 3. Authentication and authorization

```mermaid
flowchart TD
    Req["Incoming API request"] --> Kind{"Which route?"}

    Kind -->|"auth/signup, login"| Public["Public<br/>rate limited"]
    Kind -->|"meetings/by-code/code"| Public2["Public<br/>title and project name only"]
    Kind -->|"livekit/token with inviteCode"| Invite["Public<br/>sets guest cookie for that one meeting"]

    Kind -->|"projects, projects/id, projects/id/meetings,<br/>projects/id/context"| Proj{"session cookie<br/>valid?"}
    Proj -->|"no"| R401["401"]
    Proj -->|"yes"| Own{"project.owner_id<br/>= session user?"}
    Own -->|"no"| R404["404 (id not leaked)"]
    Own -->|"yes"| OK1["Allowed"]

    Kind -->|"meetings/id GET, start, transcribe, segments,<br/>livekit/token with meetingId"| Mtg{"owner of the<br/>meeting's project?"}
    Mtg -->|"yes"| Host["Host access"]
    Mtg -->|"no"| Guest{"guest cookie lists<br/>this meeting?"}
    Guest -->|"yes"| GuestOK["Guest access"]
    Guest -->|"no, no session"| R401b["401"]
    Guest -->|"no, has session"| R403["403"]

    Kind -->|"meetings/id/end"| End{"host?"}
    End -->|"yes"| Ended["Allowed"]
    End -->|"guest"| R403b["403"]

    Kind -->|"projects/id/events (SSE)"| Ev{"owner, or guest of<br/>a meeting in the project?"}
    Ev -->|"yes"| Stream["Event stream"]
    Ev -->|"no"| R4xx["401 / 403"]
```

## 4. Page and route map

```mermaid
flowchart LR
    subgraph Pages
        P1["/"]
        P2["/login"]
        P3["/join/code"]
        P4["/p/id (redirects)"]
        P5["/p/id/meetings"]
        P5b["/p/id/context"]
        P6["/m/id/call"]
    end

    subgraph API
        A1["/api/auth/signup, login, logout, me"]
        A2["/api/projects"]
        A3["/api/projects/id"]
        A4["/api/projects/id/meetings"]
        A4b["/api/projects/id/context, context/contextId"]
        A5["/api/projects/id/events"]
        A6["/api/meetings/by-code/code"]
        A7["/api/livekit/token"]
        A8["/api/meetings/id"]
        A9["/api/meetings/id/start"]
        A10["/api/meetings/id/end"]
        A11["/api/meetings/id/segments"]
        A11b["/api/meetings/id/transcribe"]
        A12["/api/health"]
    end

    P1 --> A2
    P2 --> A1
    P3 --> A6
    P3 --> A7
    P4 --> P5
    P5 --> A3
    P5 --> A4
    P5 --> A5
    P5b --> A4b
    P6 --> A8
    P6 --> A7
    P6 --> A9
    P6 --> A10
    P6 --> A11
    P6 --> A11b
    P6 --> A5
```

## 5. Server modules

```mermaid
flowchart TD
    Routes["app/api/**/route.ts"] --> http["server/http.ts<br/>handle, ApiError, parseBody, rateLimit"]
    Routes --> auth["server/auth.ts<br/>hash, sign, cookies, access checks"]
    Routes --> queries["server/queries.ts<br/>getProject, getMeeting, createMeeting"]
    Routes --> segments["server/segments.ts<br/>addSegment"]
    Routes --> stt["server/stt.ts<br/>transcribeSarvam"]
    stt --> env
    Routes --> livekitmod["server/livekit.ts<br/>broadcastSegment"]
    Routes --> dedupe["server/segment-dedupe.ts<br/>TtlMap"]
    Routes --> sse["server/sse.ts<br/>publish, subscribe"]

    auth --> env["server/env.ts"]
    auth --> db["server/db<br/>index.ts + schema.ts"]
    auth --> queries
    queries --> db
    segments --> db
    livekitmod --> env
    db --> env
```

## 6. Data model (tables in use)

Other tables from the earlier product (assumption, evidence, link, fact, status_event) still exist in the database but no code uses them.

```mermaid
erDiagram
    app_user ||--o{ project : owns
    project ||--o{ project_context : has
    project ||--o{ meeting : has
    meeting ||--o{ segment : contains

    app_user {
        uuid id PK
        text email UK
        text name
        text password_hash
        timestamptz created_at
    }
    project {
        uuid id PK
        uuid owner_id FK "nullable"
        text name
        text description
        text target_user
        timestamptz created_at
    }
    project_context {
        uuid id PK
        uuid project_id FK
        text title
        text content "plain text, max 20000 chars"
        timestamptz created_at
        timestamptz updated_at
    }
    meeting {
        uuid id PK
        uuid project_id FK
        text title
        text invite_code UK
        enum state "scheduled, live, ended"
        timestamptz scheduled_for
        timestamptz started_at
        timestamptz ended_at
        date held_at
    }
    segment {
        uuid id PK
        uuid meeting_id FK
        int idx "unique with meeting_id"
        text speaker
        text text
        real start_sec
        timestamptz created_at
    }
```

## 7. Meeting lifecycle

```mermaid
stateDiagram-v2
    [*] --> scheduled: host creates meeting
    scheduled --> live: first participant connects (POST start)
    live --> live: segments saved and broadcast
    scheduled --> ended: host ends call
    live --> ended: host ends call (POST end)
    ended --> [*]: transcript read-only, new segments rejected with 409
```
