@AGENTS.md

# Task 2 — Riva: AI Candidate Screening Chatbot + Résumé Intake

> **STATUS: DESIGN ONLY. No code has been written.** Nothing under `app/`,
> `components/`, `lib/`, or in `recruitflow-backend/` has been touched for this task.
> Implementation waits for an explicit **"Proceed with the To-Do list"**.
>
> Line 1's `@AGENTS.md` import is deliberately preserved — it carries the Next.js 16
> warning that governs every file in this repo.

---

## 1. Scope

Riva is a **7th agent**: a conversational front-desk assistant embedded in the
**Candidate Dashboard only** (`/portal/*`). She must:

1. Answer questions about currently open roles, read live from Neon PostgreSQL.
2. Collect an application conversationally (name, experience, job title, résumé) and —
   after **explicit confirmation** — hand the payload to the **existing, unmodified**
   `POST /applications` endpoint, which fires the existing 6-agent pipeline
   (confirmation email → parse → score → recruiter dashboard).
3. Persist her conversation per candidate so it reloads accurately on the next login.

**Out of scope — and strictly so:** the public career site, the **Recruiter Dashboard**, the
**Admin Dashboard**, the six existing recruiter-facing agents, and any behavioural change to
the current application/scoring flow. Riva is candidate-facing only. She has no relationship
with the Recruiter Dashboard, and she does not modify, rewrite, or connect directly to the
code of the six agents.

---

## 2. Non-negotiables

| # | Rule | How this design honours it |
|---|---|---|
| 1 | Existing code is sacred | Riva is **additive**. New agent file, new context class, new router, new models, new frontend components. Exactly **three** existing files get a mechanical edit (see §11). Zero edits to the six agents, `runner.py`'s pipelines, `intake_service.py`, `storage_service.py`, `deps.py`, auth, calendar, or email. |
| 2 | Logged-in candidates only | Widget mounts in `app/portal/layout.tsx`, which `proxy.ts` already gates on the `candidate_access_token` cookie. Every Riva endpoint depends on `require_role(UserRole.candidate)`. Two independent gates: route guard (UX) + server role check (security). |
| 3 | Pipeline reuse, not replication | The application is submitted to **`POST /applications`** — the *exact same endpoint, with the exact same multipart payload*, that the existing web apply form (`ApplyForm.tsx` → `submitApplication()`) posts to. Riva adds **no** new submission path. That endpoint already triggers the six-agent pipeline in the background; Riva never calls `Runner.run` on an existing agent and never touches `intake_service`. |
| 4 | **Strict separation of concerns** | Riva is a **candidate-facing conversational agent only**. She has **no relationship with the Recruiter Dashboard** and **no direct connection to the six recruiter-facing agents** — she does not import them, call them, or reference their modules. Her only job regarding applications is to collect the payload in chat and hand it to the existing HTTP endpoint. After that POST returns, **Riva's job is done**. |
| 5 | The six agents stay 100% untouched | Riva's backend code imports **nothing** from `orchestrator_agent.py`, `resume_parser_agent.py`, `scoring_agent.py`, `scheduling_agent.py`, `email_agent.py`, `reply_intent_agent.py`, `runner.py`, `context.py`, `intake_service.py`, or `storage_service.py`. The pipeline is reached only as a side effect of the existing endpoint doing what it already does. |
| 6 | Recruiter & Admin dashboards stay 100% untouched | No file in `recruitflow-recruiter/` or `recruitflow-admin/` is opened. They observe Riva-sourced applications through the same unchanged ATS feed. |
| 7 | No secret leaks | Riva runs server-side through the existing OpenRouter wiring (`get_agent_model()`). No key reaches the browser. |

---

## 3. Deep codebase analysis — COMPLETED before any design decision

No part of this plan is guessed. Two exhaustive read-only passes over
`recruitflow-backend/` and `recruitflow-website/` were completed *before* this document
was written, covering the three areas required:

**(a) The Next.js → FastAPI authentication flow, end to end**
`proxy.ts` matches `["/portal", "/portal/:path*"]`, reads the httpOnly
`candidate_access_token` cookie, decodes it **unverified** (UX hint only), redirects to
`/login?next=` when missing/expired and to `homeForRole(role)` on a role mismatch.
Browser calls go to `/backend/*`, a same-origin Next rewrite (`next.config.ts`) to the
Render origin, so cookies ride along; `apiFetch` sets `credentials:"include"` plus
`X-Portal: candidate` and retries once through `/auth/refresh` on a 401. Server-side,
`deps.py::_select_access_token` picks the cookie named by `X-Portal` (or the single
unambiguous one), `get_current_user` verifies the JWT properly, and
`require_role(*roles)` is the actual security boundary. Access 15 min / refresh 7 days.

**(b) The Neon PostgreSQL schema (SQLModel)**
All 8 models read: `User`, `RecruiterProfile`, `Job`, `Candidate`, `Application`,
`Interview`, `EmailLog`, `AgentRun`. Conventions recorded below and matched exactly by
the two new tables. Alembic head confirmed as `b2f4a1c9d3e7`.

**(c) The exact six-agent pipeline — traced line by line**

```
POST /applications  (app/api/applications.py — Depends(get_optional_user))
  ├─ await resume.read()  →  file_bytes
  ├─ IntakeMetadata(job_id, email, source_channel=website,
  │                 full_name, phone, location, linkedin, portfolio,
  │                 user_id=current_user.id if current_user else None,
  │                 content_type=resume.content_type)
  └─ intake_service.ingest_resume(session, file_bytes, filename, metadata)
       ├─ _validate_filetype  (PDF/DOCX, magic bytes, ≤10 MB)
       ├─ Job must exist and be status=open           → job_unavailable  → 404
       ├─ find-or-create Candidate by lowercased email
       ├─ DuplicateApplication on (candidate_id, job_id) — BEFORE any upload → 409
       ├─ storage_service.store_resume  →  Cloudflare R2 key resumes/{uuid}{ext}
       ├─ Application(status=received)  +  commit
       └─ _handoff_to_orchestrator(application.id)
            └─ runner.run_resume_pipeline_bg   (threading.Thread daemon + asyncio.run)
                 ├─ run_email_bg(app_id, "confirmation")      → Email Agent
                 ├─ extract résumé text (PyMuPDF / python-docx)
                 ├─ Orchestrator Agent  →  handoff  →  Resume Parser Agent
                 ├─ status = parsed · agent_runs row · events.publish(APPLICATION_UPDATED)
                 └─ await run_scoring_pipeline(app_id)
                      └─ Scoring Agent → score/classification/explanation
                         status = scored · agent_runs · events.publish
                            └─ WS /ats/ws  →  recruiter + admin dashboards
```

Scheduling, Email and Reply-Intent agents run later, driven by recruiter actions and the
IMAP worker. **Riva participates in none of this.** She stops at the `POST /applications`
call; every arrow below that line is existing code that runs untouched.

### Facts that changed the design

- **The avatar path in the brief is wrong.** The file is at
  `public/Logos/chatbot-avatar.svg` (capital **L**, plural **Logos**), so the correct
  `src` is **`/Logos/chatbot-avatar.svg`**. It is also **untracked in git** — it must be
  `git add`ed or production will 404. No external avatar API is used.
- **A WebSocket chat cannot be authenticated here.** `lib/api.ts:272` documents that WS
  can't traverse the `/backend/*` Next rewrite, so a socket goes cross-origin to
  `onrender.com` and the httpOnly `candidate_access_token` cookie is **not sent**.
  → **Riva uses plain `POST` over `/backend/*`**, where cookie auth already works.
  (The existing `WS /ats/ws` accepts every connection unauthenticated and fans out all
  events — that pattern must **not** be copied for a candidate-facing feature.)
- **`X-Portal: candidate` is automatic.** `next.config.ts` hard-sets
  `NEXT_PUBLIC_PORTAL: "candidate"`, and `apiFetch` attaches the header, so
  `get_current_user` resolves the right cookie with no extra work.
- **No auth context exists in the frontend.** `DashboardShell` and each page call
  `getCurrentUser()` independently in a `useEffect`. Riva will not add a provider; it
  simply relies on cookie auth per request.
- **There is no markdown renderer, no toast, and no textarea component.** `lucide-react`
  is installed but unused, so `MessageCircle` / `Send` / `Paperclip` / `X` are free.
- **A résumé file is mandatory** and must be real PDF/DOCX bytes ≤ 10 MB with matching
  magic bytes. Riva cannot invent one, so the widget must capture a real `File`.
- **`submitApplication(form: FormData)` already exists** in `lib/api.ts` and is what
  `ApplyForm.tsx` calls. Riva's submission reuses that exported function verbatim — no
  new upload code, no new endpoint, byte-identical request shape.
- **Duplicate applications** raise `DuplicateApplication` *before* any file is stored, and
  the endpoint maps it to **409** — safe to surface as a friendly chat reply.
- **Agent tool conventions** (must be matched): `@function_tool(strict_mode=False)` on a
  sync `def`; first arg `ctx: RunContextWrapper[...]`; trusted IDs read from
  `ctx.context`, **never** from model arguments; tools open their own
  `with Session(engine)`; tools return **strings** and never raise; **flat scalar
  parameters only** — a nested Pydantic arg emits `$ref`/`$defs` that some OpenRouter
  providers reject.
- **Models**: UUID4 client-side PKs, explicit `__tablename__`, `str, Enum` classes,
  `sa_column=Column(JSON)` (generic `JSON`, not JSONB), naive `datetime.utcnow`
  timestamps, no `Relationship()`, no indexes anywhere.
- **Alembic head is `b2f4a1c9d3e7`** → the new migration's `down_revision`.
- `create_db_and_tables()` runs `create_all` on every boot, so new tables appear even
  before the migration is applied — the migration still ships, for parity.

Phase 0 of §12 re-verifies these facts against `git log`/`git diff` immediately before
the first line of code is written, in case anything moved.

---

## 4. Architecture

```
CANDIDATE DASHBOARD (Next.js 16 — /portal/* only)
┌──────────────────────────────────────────────────────────────┐
│ app/portal/layout.tsx  →  <RivaWidget />   (one added line)   │
│   components/riva/RivaWidget.tsx     launcher + panel         │
│   components/riva/RivaMessage.tsx    bubble + avatar          │
│   components/riva/RivaMarkdown.tsx   safe markdown renderer   │
│   components/riva/RivaComposer.tsx   input + presets + attach │
│   lib/riva.ts                        typed API client         │
└───────────────────────────┬──────────────────────────────────┘
                            │ fetch, credentials:"include",
                            │ X-Portal: candidate
                            ▼
        /backend/riva/*  (same-origin Next rewrite → Render)
                            ▼
BACKEND (FastAPI) — NEW CODE, FULLY SELF-CONTAINED
┌──────────────────────────────────────────────────────────────┐
│ app/api/riva.py     require_role(candidate) on every route    │
│   GET    /riva/conversation     reload history                │
│   POST   /riva/messages         send a turn → Riva replies    │
│   DELETE /riva/conversation     start a new chat (optional)    │
└───────────────────────────┬──────────────────────────────────┘
                            ▼
│ app/agents/riva_agent.py      Agent[RivaContext] + 6 tools    │
│ app/agents/riva_context.py    RivaContext (trusted state)     │
│ app/agents/riva_runner.py     Runner.run + agent_runs logging │
                            ▼
    ┌───────────────────┬──────────────────────────────┐
    ▼                   ▼                              ▼
 chat_conversations   jobs (read-only)      draft complete + confirmed
 chat_messages        this candidate's         → reply carries
 (Neon Postgres)      applications              submission:{ready}
                      (read-only)                     │
═══════════════════════ RIVA'S JOB ENDS HERE ═════════╪═══════════
                                                      ▼
              THE HAND-OFF: the widget calls the EXISTING
              submitApplication(FormData)  →  POST /applications
              (identical to what ApplyForm.tsx already does)
                                                      ▼
                              EXISTING 6-AGENT PIPELINE — UNCHANGED
                              intake_service.ingest_resume →
                              confirmation email → Orchestrator →
                              Resume Parser → Scoring → events.publish
                              → recruiter dashboard + agent_runs
```

**Turn lifecycle:** `POST /riva/messages` → persist the user row → load the last N turns
→ build `RivaContext(user_id, candidate_id, conversation_id)` → `await Runner.run(...)`
→ persist the assistant row → write one `agent_runs` row (`agent_name="Riva Agent"`) →
return the assistant message as JSON. Synchronous within the request, because the
candidate is waiting for the reply. **No background work is ever spawned by Riva.**

**Submission lifecycle:** when the draft is complete and the candidate has said yes, the
reply JSON carries a `submission` object. The widget then performs the *ordinary* apply
request — the same `submitApplication(FormData)` call, the same `POST /applications`
endpoint, the same cookies — and feeds the outcome (201 / 409 / 413 / 404) back into the
chat as Riva's next turn. Everything after the 201 is pre-existing behaviour.

---

## 5. Database schema changes (Neon PostgreSQL)

Two new tables. No existing table is altered, no column is dropped, no enum is extended.

### `chat_conversations` — one open conversation per candidate

| Column | Type | Notes |
|---|---|---|
| `id` | `sa.Uuid()` PK | `default_factory=uuid.uuid4` |
| `user_id` | `sa.Uuid()` FK → `users.id` | not null; the ownership key for reload |
| `title` | `AutoString` nullable | first user message, truncated — for future multi-thread UI |
| `draft` | `sa.JSON()` nullable | in-flight application draft (below) |
| `is_active` | `bool` default `True` | `DELETE /riva/conversation` flips this instead of deleting history |
| `created_at` / `updated_at` | `sa.DateTime()` | naive `datetime.utcnow`, bumped manually |

`draft` shape (all keys optional until collected):

```json
{
  "full_name": "…",
  "years_experience": "…",
  "job_id": "uuid",
  "job_title": "…",
  "resume_attached": true,
  "resume_filename": "cv.pdf",
  "confirmation_requested_at": "2026-08-28T10:00:00",
  "submitted_application_id": "uuid"
}
```

The résumé **bytes are never sent to Riva**. The widget holds the chosen `File` in browser
memory and only reports its filename, so the draft records that an attachment exists; the
bytes go straight to `POST /applications` at submit time (§7).

### `chat_messages` — the persisted transcript

| Column | Type | Notes |
|---|---|---|
| `id` | `sa.Uuid()` PK | |
| `conversation_id` | `sa.Uuid()` FK → `chat_conversations.id` | not null |
| `role` | `sa.Enum(name="chatrole")` | `user` / `assistant` / `system` |
| `content` | `AutoString` | markdown text as Riva emitted it |
| `meta` | `sa.JSON()` nullable | tool names used, attached résumé filename, submitted application id |
| `created_at` | `sa.DateTime()` | ordering key |

**Deliberate deviations from house style, both justified:**

- `chat_messages.conversation_id` gets `index=True`. No model in this repo declares an
  index, but the transcript is read on every single turn and grows without bound.
- `role` is a native Postgres enum named `chatrole`, matching `agentrunstatus` etc.

**Registration + migration**

- Add `ChatConversation`, `ChatMessage`, `ChatRole` to `app/models/__init__.py`'s imports
  and `__all__` — otherwise `create_all` and Alembic autogenerate silently miss them.
- New revision with `down_revision = 'b2f4a1c9d3e7'`, `import sqlmodel`, and types
  emitted as `sa.Uuid()` / `sqlmodel.sql.sqltypes.AutoString()` / `sa.JSON()` /
  `sa.DateTime()` / `sa.Enum('user','assistant','system', name='chatrole')`.
  `downgrade()` drops `chat_messages` then `chat_conversations`, then the enum.

---

## 6. Backend design

### 6.1 `app/agents/riva_context.py` — trusted state

`AgentRunContext.application_id` is **required and non-Optional**, so Riva cannot reuse
it. A separate dataclass keeps `context.py` untouched:

```python
@dataclass
class RivaContext:
    user_id: uuid.UUID          # from the JWT cookie — never from the model
    conversation_id: uuid.UUID
    email: str                  # the authenticated account email
    full_name: str
    candidate_id: uuid.UUID | None = None
    submitted_application_id: uuid.UUID | None = None
    tools_used: list[str] = field(default_factory=list)
```

Every id a tool acts on comes from here. The LLM can never redirect a tool at another
candidate — the same security property the existing tools rely on.

### 6.2 `app/agents/riva_agent.py` — the 7th agent

`build_riva_agent() -> Agent[RivaContext]`, a **new instance per run**, `model=get_agent_model()`,
module-level `PROMPT`, exactly like the other six.

**Tools (all flat scalar params, all sync, all returning strings):**

| Tool | Purpose |
|---|---|
| `list_open_jobs()` | `select(Job).where(Job.status == JobStatus.open)` — the identical query `GET /jobs` uses, so chat answers can never disagree with the website. Returns `json.dumps` of id/title/skills/description-excerpt. `datetime` fields are dropped (not JSON-serialisable). |
| `get_job_details(job_query: str)` | Resolve one job by id **or** fuzzy title, return full description + required skills. |
| `get_my_applications()` | Read-only status of the candidate's own applications, matched by `user_id OR email` mirroring `/applications/mine`. Lets Riva answer "where's my application?" without a second round trip. |
| `save_application_draft(full_name: str = "", years_experience: str = "", job_query: str = "")` | Merges into `chat_conversations.draft`, resolves `job_query` → a real open `job_id`, returns what is **still missing** so Riva knows what to ask next. Never invents values. |
| `request_confirmation()` | Refuses unless name + experience + job + `resume_attached` are all present; stamps `confirmation_requested_at`; returns the exact recap line for Riva to read back. |
| `mark_ready_to_submit()` | Refuses unless `confirmation_requested_at` is set. Sets `draft.ready = true` and returns a short "handing off now" string. **This tool does not create anything** — no candidate row, no application row, no file write, no pipeline call. It only flips a flag that the router turns into a `submission` object in the HTTP response (§7). |

Riva has **no tool that writes an application.** The strongest form of the separation the
brief requires: even a fully jailbroken prompt cannot make the agent submit anything,
because no code path from the agent reaches `intake_service`, `storage_service`, or the
six agents. `riva_agent.py` imports only `Job`, `JobStatus`, `Application`, `Candidate`,
and its own `ChatConversation`.

The confirmation gate is enforced **in code**, not merely in the prompt: `mark_ready_to_submit`
hard-fails if `request_confirmation` has not run. Prompt discipline alone is not a control.

### 6.3 `app/agents/riva_runner.py` — one turn

`async def run_riva_turn(user, conversation_id, user_message) -> dict`.

- Calls `Runner.run(build_riva_agent(), agent_input, context=ctx, max_turns=12)` **directly**.
  `_run_agent_with_retry` is the wrong wrapper here — it retries until a success predicate
  is met, which is meaningless for open-ended conversation.
- `agent_input` = the last **20** messages rendered as a transcript plus a trusted preamble
  (`The signed-in candidate is <name> <email>`), so Riva never has to ask for the email.
- Wraps `Runner.run` in `try/except`: on failure, return a graceful apology message,
  persist it, and log a `failed` `agent_runs` row. A chatbot outage must never 500 the portal.
- Logs every turn via the existing `_log_agent_run` helper with `agent_name="Riva Agent"`
  and `application_id=None` until an application exists (the column is already nullable).
  `_log_agent_run` is module-private to `runner.py`; import it as-is rather than editing it.

### 6.4 `app/api/riva.py` — the router

House style: no `response_model`, hand-built dicts, `Depends(get_session)`.

| Method | Path | Body → Returns |
|---|---|---|
| `GET` | `/riva/conversation` | `{conversation_id, messages:[{id,role,content,created_at}], draft_summary}` — the reload path |
| `POST` | `/riva/messages` | `{content, resume_filename?}` → `{user_message, assistant_message, submission?}` |
| `POST` | `/riva/outcome` | `{status, application_id?, detail?}` → records what `POST /applications` answered and returns Riva's closing turn |
| `DELETE` | `/riva/conversation` | archives the thread (`is_active=False`) and returns a fresh empty one |

`submission` is present only when the draft is complete, confirmed, and `ready`:
`{job_id, job_title, full_name, email}`. It is an instruction to the **widget**, which then
performs the ordinary apply request. There is **no** résumé-upload endpoint in Riva — the
only route that ever receives résumé bytes is the pre-existing `POST /applications`.

Every route: `user = Depends(require_role(UserRole.candidate))`. A recruiter or admin
cookie gets **403**; no cookie gets **401**. Mounted with one added line in `main.py`:
`app.include_router(riva.router, prefix="/riva", tags=["riva"])`.

Rate limiting: reuse `app/core/rate_limit.py` on `POST /riva/messages` (each turn costs an
LLM call) — a per-user cap, not a global one.

---

## 7. The hand-off — how the existing 6-agent pipeline is triggered

**Rule: Riva collects the payload. The existing endpoint does the rest.**

The submission is performed by the widget, using the *same exported client function the
web apply form already uses*, against the *same endpoint*, with the *same multipart
payload* and the *same cookies*:

```ts
// components/riva/RivaWidget.tsx — reusing lib/api.ts, unmodified
const form = new FormData();
form.append("job_id", submission.job_id);
form.append("full_name", submission.full_name);
form.append("email", submission.email);      // from getCurrentUser(), not typed by the model
form.append("resume", attachedFile);         // the real File held in browser memory
const app = await submitApplication(form);   // → POST /applications  (existing, untouched)
```

`submitApplication` is the existing function in `lib/api.ts`. `ApplyForm.tsx` builds the
identical `FormData` today. From the backend's point of view a Riva application and a
web-form application are **indistinguishable** — same route, same handler, same
`get_optional_user` cookie identity, same `IntakeMetadata`, same
`source_channel=website`, same `ingest_resume`, same `run_resume_pipeline_bg`.

### Sequence

| # | Actor | Step |
|---|---|---|
| 1 | Candidate | Attaches a `.pdf`/`.docx` in the composer. The `File` stays in **browser memory only** — nothing is uploaded yet. The widget tells Riva the filename via `resume_filename`. |
| 2 | Riva | Collects Name, Experience and Job Title across turns via `save_application_draft`. |
| 3 | Riva | `request_confirmation()` → asks **"Should I submit your application for *[Role]*?"** with a bulleted recap. |
| 4 | Candidate | "Yes." |
| 5 | Riva | `mark_ready_to_submit()` → the reply JSON carries `submission{job_id, job_title, full_name, email}`. **Riva's job ends here.** |
| 6 | Widget | Calls the existing `submitApplication(FormData)` → **`POST /applications`**. |
| 7 | Backend (existing) | `ingest_resume` → validate → R2 upload → `Candidate` + `Application(received)` → `run_resume_pipeline_bg` → Confirmation email → Orchestrator → Résumé Parser → Scoring → `events.publish` → recruiter dashboard. **Zero new code.** |
| 8 | Widget | Posts the outcome to `POST /riva/outcome`; Riva replies with the confirmation, or the friendly duplicate/closed-job/too-large message, and it is persisted in the transcript. |

### Why this shape, explicitly

- It is the *literal* reading of the boundary rule: the payload goes to the same endpoint a
  standard web form uses. Nothing else in the codebase can claim that.
- No server-to-server HTTP call to our own API (which on Render's free tier would risk a
  cold-start self-deadlock, and would need the candidate's cookie forwarded).
- No new file-upload endpoint, and therefore no second copy of the résumé and **no orphaned
  R2 objects** — the earlier staging design had both.
- `intake_service.py` and `storage_service.py` are not even imported by Riva's code.
- The 409 duplicate / 404 closed-job / 413 too-large mappings the endpoint already returns
  are reused verbatim as chat copy.

### Accepted trade-offs, recorded honestly

- **A page reload before submitting loses the attachment**, because the `File` lives in
  memory. Riva detects `resume_attached` in the draft with no live `File` and simply asks
  for the file again. The alternative — a staging upload — costs a new endpoint plus
  orphaned objects, and weakens the "one submission path" guarantee.
- **`source_channel` is `website`**, because the endpoint hard-codes it and the endpoint is
  not being edited. Riva-sourced applications are indistinguishable from web-form ones in
  the ATS. Adding a fifth `chat` enum value would mean an `ALTER TYPE` migration plus
  recruiter/admin filter changes — say the word and it becomes a separate, deliberate task.
- **`years_experience` has no column.** `IntakeMetadata` has no such field, so it is kept in
  the draft, echoed in the recap, and written into the `agent_runs` summary. Nothing is
  lost: the Scoring Agent derives experience from the résumé itself.
- **The widget carries the submit call.** Slightly more frontend logic than a backend
  trigger, but it is the only way to hit the real endpoint with the candidate's own cookie
  and zero new backend upload code.

---

## 8. Frontend design (Next.js 16 · Tailwind v4)

### 8.1 Mount point

One line added to `app/portal/layout.tsx`, as a sibling of `{children}` inside
`DashboardShell`. Because `RivaWidget` is `position: fixed`, rendering inside `<main>` is
fine. It therefore appears on all nine portal pages and **nowhere else** — never on the
public site, never on `/login` or `/signup`.

### 8.2 Components (all new, all under `components/riva/`)

| File | Responsibility |
|---|---|
| `RivaWidget.tsx` | `"use client"`. Launcher FAB → panel. Owns messages, loading, error, the attached `File`, and the submit hand-off (§7). Loads history once on open via `GET /riva/conversation`. |
| `RivaHeader.tsx` | Avatar + **"Meet Riva"**, subtitle **"Your AI career assistant. Ask Riva anything about your job search."**, close button. |
| `RivaMessage.tsx` | One bubble. Bot side: `/Logos/chatbot-avatar.svg` + markdown. Candidate side: existing `<Avatar>` + plain text. |
| `RivaMarkdown.tsx` | Renders **bold**, bullets, numbered lists, headings, inline code, and links. Escapes HTML first — Riva's output is model-generated text and is treated as untrusted. |
| `RivaComposer.tsx` | Auto-growing textarea (Enter sends, Shift+Enter newlines), paperclip **file picker** (client-side `.pdf`/`.docx` + 10 MB pre-check; the file is held in state, **not uploaded**), send button, and the two preset chips. |
| `RivaTyping.tsx` | Three-dot animation while awaiting the reply. |
| `lib/riva.ts` | `getRivaConversation()`, `sendRivaMessage(content, resumeFilename?)`, `postRivaOutcome(...)`, `resetRivaConversation()` — all via the existing `apiFetch`, so cookie auth, `X-Portal`, the 401-refresh replay, and the cold-start `wakeFetch` retry all come for free. The actual application POST reuses `submitApplication()` from `lib/api.ts`, unmodified. |

### 8.3 Preset questions

Two chips directly above the input, visible when the transcript is empty (and re-shown
after a reset). Clicking one **sends immediately**:

1. `I need help applying for a job.`
2. `What roles are currently open?`

### 8.4 Positioning — bottom-right, fixed, on every breakpoint (hard requirement)

Both the **trigger button** and the **open chat window** are `position: fixed` and anchored
to the **bottom-right corner** of the viewport. This is a stated requirement, not a
preference, so it holds at every breakpoint — the panel never becomes a centred modal, a
left-side drawer, or a top sheet.

| Breakpoint | Launcher (FAB) | Panel |
|---|---|---|
| Mobile `< 640px` | `fixed bottom-4 right-4`, 56 px, `pb-[env(safe-area-inset-bottom)]` | `fixed bottom-20 right-3 left-3 max-h-[72vh]` — grows leftward from the bottom-right anchor rather than covering the screen, so the header and page content stay visible |
| Tablet `640–1023px` | `fixed bottom-6 right-6` | `fixed bottom-24 right-6 w-[400px] h-[min(600px,72vh)]` |
| Desktop `≥ 1024px` | `fixed bottom-6 right-6` | `fixed bottom-24 right-6 w-[420px] h-[min(640px,80vh)]` — top edge stays clear of the 64 px sticky header |

**Not blocking anything (verified against the existing layout):**

- The FAB sits in the bottom-right; `DashboardShell`'s mobile drawer toggle is **top-left**
  and the sidebar is on the left, so there is no overlap on any breakpoint.
- No portal page has a bottom-right control (no bottom bar, no bottom-right pagination, no
  bottom-right FAB) — checked across all nine `/portal/*` pages.
- The panel is height-capped with `max-h`/`vh` units and scrolls internally, so it can never
  push the page or overflow the viewport, and the composer stays reachable when the mobile
  keyboard opens.
- Only the panel is `fixed`; **no wrapper, transform, overflow or padding is added to
  `DashboardShell` or any page**, so the responsive layout is mathematically unchanged when
  the widget is closed, and unchanged underneath when it is open.
- While open on mobile the page behind stays scrollable — no `overflow: hidden` on `<body>`,
  which would alter existing scroll behaviour.

**Layering (`z-index`), fitted into the stack that already exists:**

| Layer | z | Why |
|---|---|---|
| `BackendWakeBanner` | `z-[100]` | existing — the "Waking up the server…" banner must stay visible during a Render cold start |
| Riva panel | `z-[80]` | above all page content |
| Riva launcher | `z-[70]` | below its own panel |
| Mobile nav drawer + backdrop | `z-50` | existing — Riva deliberately sits above it, and the panel closes on route change so the two are never both in use |
| Sticky header | `z-40` | existing |

No existing `z-index` value is changed.

### 8.5 Aesthetic match

Reuse the established recipe rather than inventing one: `rounded-xl` / `rounded-2xl`
surfaces, `border-zinc-200`, `bg-white`, `shadow-xl`, page tint `bg-zinc-50`,
`font-poppins` for the header and buttons, Inter for message text,
`bg-primary text-white` for the candidate's bubbles and the send button,
`bg-primary/10 text-primary` accents, `focus-visible:ring-4 ring-primary/25`, and the
existing brand scrollbar inside the transcript. Icons come from the already-installed
`lucide-react`. Open/close animation via `framer-motion` (installed) while honouring
`prefers-reduced-motion`, as `DashboardShell` already does.

### 8.6 Accessibility

`role="dialog"` + `aria-modal`, labelled by the header; Escape closes; focus moves to the
textarea on open and back to the FAB on close; the transcript is an `aria-live="polite"`
log; every icon-only control has an `aria-label`. Note the existing `Button` component's
`loading` prop replaces its children with "Please wait…", so the icon-only send button uses
`disabled` plus its own spinner instead.

---

## 9. Response-format contract

Riva's `PROMPT` instructs, and the UI is built to render:

- Short paragraphs — **never** a wall of text.
- Bulleted lists for options; numbered lists for steps.
- `**bold**` for job titles, field names, and the confirmation recap.
- A `###` sub-heading when covering more than one role.
- One clear question per turn when collecting application data — never a form dump.
- Job facts only from `list_open_jobs` / `get_job_details`. If a tool returns nothing, say
  so plainly instead of guessing; salary/benefits are not in the schema, so Riva must not
  invent them.
- The confirmation turn is fixed: **"Should I submit your application for *[Role]*?"**
  preceded by a bulleted recap of name, experience, role, and attached file.

---

## 10. Isolation guarantees

| Existing surface | Guarantee |
|---|---|
| Auth (`deps.py`, `security.py`, `auth.py`, cookies, refresh) | **Not touched.** Riva consumes `require_role` as-is. |
| Neon schema | **Additive only** — two new tables. No `ALTER`, no drop, no enum change. |
| The six agents — `orchestrator_agent.py`, `resume_parser_agent.py`, `scoring_agent.py`, `scheduling_agent.py`, `email_agent.py`, `reply_intent_agent.py` | **100% untouched, and not imported.** Riva has her own agent, context and runner module. She never calls `Runner.run` on any of them and never references their tools. |
| `runner.py` pipelines (`run_resume_pipeline`, `run_scoring_pipeline`, `run_email_bg`, `_spawn`) | **Not touched, and not called by Riva.** They are reached only by the existing `POST /applications` handler, as they are today. The single import Riva takes from this module is the read-only logging helper `_log_agent_run`. |
| `intake_service.py`, `storage_service.py` | **Not touched and not imported by Riva at all.** Reached only through the existing endpoint. |
| `applications.py` (`POST /applications`) | **Not touched.** Called over HTTP by the widget exactly as `ApplyForm.tsx` calls it. |
| `files.py` / `GET /files/{key}` | Not touched. Résumés stay in the private R2 bucket behind the authenticated route. |
| Google Calendar, Resend/email, IMAP workers | **Not touched.** Riva sends no email herself; the confirmation email is the existing Email Agent's, fired by the existing pipeline. |
| **Recruiter Dashboard** (`recruitflow-recruiter/`) | **100% untouched — no file in that repo folder is opened.** Riva has no relationship with it. Recruiters see Riva-sourced applications through the same unchanged ATS feed and WebSocket. |
| **Admin Dashboard** (`recruitflow-admin/`) | **100% untouched.** The Agent Activity Log picks up `Riva Agent` rows automatically because it reads `agent_runs` unfiltered — no code change needed. |
| Public career site, `ApplyForm.tsx`, `/login`, `/signup` | Not touched. The widget cannot render there. |

---

## 11. File-change allowlist

**Create — backend (6)**
`app/models/chat.py` · `app/agents/riva_context.py` · `app/agents/riva_agent.py` ·
`app/agents/riva_runner.py` · `app/api/riva.py` ·
`app/db/migrations/versions/<rev>_add_chat_tables.py`

**Create — frontend (7)**
`components/riva/RivaWidget.tsx` · `RivaHeader.tsx` · `RivaMessage.tsx` ·
`RivaMarkdown.tsx` · `RivaComposer.tsx` · `RivaTyping.tsx` · `lib/riva.ts`

**Edit — exactly three existing files, mechanical additions only**

1. `app/main.py` — add `riva` to the `from app.api import …` line + one `include_router`.
2. `app/models/__init__.py` — add the three new names to the imports and `__all__`.
3. `app/portal/layout.tsx` — one `<RivaWidget />` line.

**Also required:** `git add public/Logos/chatbot-avatar.svg` (currently untracked).

**Explicitly not touched:** any of the six agent files, `runner.py`, `context.py`,
`intake_service.py`, `storage_service.py`, `email_service.py`, `calendar_service.py`,
`deps.py`, `security.py`, `auth.py`, `applications.py`, `jobs.py`, `ats.py`, `files.py`,
existing models, existing migrations, `proxy.ts`, `next.config.ts`, `lib/api.ts`,
`ApplyForm.tsx`, `DashboardShell.tsx`, `globals.css`, and `package.json`.

> `lib/api.ts` needs no change. `apiFetch` already handles JSON bodies, and the existing
> exported `submitApplication(form: FormData)` is exactly what the hand-off in §7 calls —
> reusing it is the whole point, so it must stay untouched.

---

## 12. To-Do checklist

### Phase 0 — Deep codebase review (MANDATORY, before any file is created or edited)

The full pass is already **done** and its findings are recorded in §3. Phase 0 is the
re-verification gate: nothing gets written until each box below is ticked in the working
tree as it stands *today*.

- [x] Re-read the auth chain end to end: `proxy.ts` → `next.config.ts` rewrite → `lib/api.ts`
      (`portalHeaders`, `credentials:"include"`, the 401 refresh replay) → `deps.py`
      (`_select_access_token`, `get_current_user`, `get_optional_user`, `require_role`) →
      `security.py`. Confirm no change is needed anywhere in it.
- [x] Re-read every SQLModel in `app/models/` and re-confirm the conventions in §3
      (UUID PKs, explicit `__tablename__`, `str, Enum`, generic `JSON`, naive `utcnow`,
      no `Relationship()`, no indexes).
- [x] Re-confirm the Alembic head is still `b2f4a1c9d3e7` (`alembic heads`).
- [x] Re-trace the six-agent pipeline against the source: `applications.py::submit_application`
      → `intake_service.ingest_resume` → `_handoff_to_orchestrator` → `runner.run_resume_pipeline_bg`
      → Email Agent confirmation → Orchestrator → Résumé Parser → `run_scoring_pipeline`
      → Scoring Agent → `events.publish` → `WS /ats/ws`. Confirm the trace in §3(c) is exact.
- [x] Re-read `ApplyForm.tsx` and `lib/api.ts::submitApplication` and record the **exact**
      `FormData` field names and order, so Riva's hand-off request is byte-identical.
- [x] Re-read `agents/scoring_agent.py` and `agents/resume_parser_agent.py` **read-only**, to
      confirm nothing about them needs to change for a chat-sourced application.
- [x] Re-read `DashboardShell.tsx` + all nine `/portal/*` pages and confirm nothing occupies
      the bottom-right corner and no `z-index` above `z-50` is in use outside the wake banner.
- [x] `git status` / `git diff` clean baseline recorded, so the isolation check in Phase 5
      has something to compare against.
- [x] Place the avatar at the path the widget references. The file existed only at
      `public/Logos/chatbot-avatar.svg`; since `logo` ≠ `Logos` and Vercel's filesystem is
      case-sensitive, it was moved to `public/logo/chatbot-avatar.svg` so `/logo/chatbot-avatar.svg`
      resolves in production.
- [x] Confirm the open decision in §14 before coding

### Phase 1 — Database
- [x] `app/models/chat.py`: `ChatRole`, `ChatConversation`, `ChatMessage` in house style
- [x] Register all three in `app/models/__init__.py`
- [x] Alembic revision, `down_revision='b2f4a1c9d3e7'`, with a working `downgrade()`
- [x] `alembic upgrade head` locally against Neon; verify both tables + the `chatrole` enum
- [x] Verify no existing table was altered (`alembic history`, diff the DDL)

### Phase 2 — Riva agent (self-contained; imports nothing from the six agents)
- [x] `riva_context.py` — `RivaContext`
- [x] `riva_agent.py` — `PROMPT` (persona, tool order, confirmation script, format rules)
- [x] `list_open_jobs` + `get_job_details` (Tool 1: job knowledge)
- [x] `get_my_applications` (read-only status lookup, scoped to `ctx.context`)
- [x] `save_application_draft` (Tool 2a: dynamic collection, returns what's missing)
- [x] `request_confirmation` (Tool 2b: gate + recap; refuses on an incomplete draft)
- [x] `mark_ready_to_submit` (Tool 2c: refuses without the gate; **writes nothing** — only flips `draft.ready`)
- [x] `riva_runner.py` — `run_riva_turn`, transcript window, `agent_runs` logging, error path
- [x] Assert every tool is sync, flat-param, string-returning, `Session(engine)`-scoped
- [x] **Grep the three new agent files for `intake_service`, `storage_service`, `runner.run_`,
      `orchestrator`, `scoring_agent`, `resume_parser`, `email_agent`, `scheduling`,
      `reply_intent` — every one must return zero hits** (stricter than planned: `riva_runner.py`
      imports **nothing** from `runner.py` and writes its own local `_log_riva_run`)

### Phase 3 — API
- [x] `app/api/riva.py` — the four routes, all `require_role(UserRole.candidate)`
- [x] Find-or-create the active conversation per `user_id`
- [x] `POST /riva/messages` returns `submission` only when the draft is complete, confirmed and ready
- [x] `POST /riva/outcome` persists the result of the widget's `POST /applications` call
- [x] Rate-limit `POST /riva/messages` per user
- [x] Mount in `main.py`
- [x] Verify 401 without a cookie, 403 with a recruiter/admin cookie
- [x] Confirm **no** Riva route accepts a file upload

### Phase 4 — Frontend
- [x] `lib/riva.ts`
- [x] `RivaMarkdown.tsx` (escape-then-render; no `dangerouslySetInnerHTML` on raw model text)
- [x] `RivaMessage.tsx`, `RivaTyping.tsx`, `RivaHeader.tsx`
- [x] `RivaComposer.tsx` — textarea, presets, in-memory file picker, send
- [x] `RivaWidget.tsx` — FAB, panel, history load, optimistic user bubble, error strip, and
      the §7 hand-off calling the existing `submitApplication(FormData)`
- [x] Mount in `app/portal/layout.tsx`
- [ ] **Positioning pass (§8.4):** FAB and panel fixed bottom-right at 375 / 768 / 1440 px;
      confirm nothing is obscured, the mobile drawer toggle still works, no horizontal scroll
      appears, the composer stays visible with the mobile keyboard open, and the layout is
      pixel-identical to `main` while the widget is closed
      _(classes implemented to spec + `npm run build` passes; live browser check at each breakpoint still pending)_
- [x] `z-index` check against the mobile drawer (`z-50`) and the wake banner (`z-[100]`)
- [ ] Accessibility pass (Escape, focus, `aria-live`, labels, reduced motion)
      _(labels, `role="dialog"`/`aria-live`, and reduced-motion are in; Escape-to-close and focus management still to add)_

### Phase 5 — Verification
- [x] `python -m py_compile` on every new/edited backend file
- [x] `npm run build` in `recruitflow-website`
- [ ] End-to-end: log in as a candidate → ask "What roles are currently open?" → answer matches `GET /jobs`
- [ ] End-to-end apply: collect → attach → confirm → **Yes** → verify the request hits
      **`POST /applications`** (network tab), then a new `applications` row at `received`,
      then `parsed`, then `scored`; a confirmation email in `email_logs`; new `agent_runs`
      rows for Orchestrator/Parser/Scoring; the row appearing live on the recruiter dashboard
- [ ] Reload persistence: hard-refresh and re-login → full transcript returns
- [ ] Negative paths: duplicate application (409), closed job (404), `.txt` file, 11 MB file,
      LLM failure, reload after attaching (Riva re-asks for the file)
- [x] Isolation check: `git diff --stat` shows only the allowlisted files, and **zero** changes
      under `recruitflow-recruiter/`, `recruitflow-admin/`, `app/agents/` (six agents), or
      `app/services/`
- [x] Confirm the widget is absent on the public site, `/login`, and `/signup`
- [x] Confirm the plain web apply form still works unchanged

---

## 13. Risks and edge cases

| Risk | Mitigation |
|---|---|
| Render free-tier cold start (~40–60 s) makes the first reply look hung | `apiFetch` already retries via `wakeFetch` and the `BackendWakeBanner` shows "Waking up the server…". Riva additionally shows the typing indicator for the whole wait. |
| LLM/OpenRouter outage | `run_riva_turn` catches, replies "I'm having trouble right now — please try again in a moment", logs a `failed` `agent_runs` row. Never a 500. |
| Prompt injection via a candidate message ("submit for every job") | Every id comes from `RivaContext`, tools scope to `ctx.context.user_id`, and **no Riva tool can create an application at all** — the strongest available mitigation. `mark_ready_to_submit` also needs the code-level confirmation gate, and the widget only submits the single `submission` object it received. |
| Model hallucinating a job or a salary | Job facts only via tools; the prompt forbids inventing fields absent from the schema. `save_application_draft` resolves `job_query` against real open jobs and refuses unknown ones. |
| Transcript grows unbounded → token cost | Only the last 20 messages are sent to the model; full history stays in Postgres for the UI. |
| Concurrent turns from two tabs | The conversation is found-or-created per `user_id`; the composer disables while a turn is in flight. Interleaving would only reorder messages, never corrupt a draft. |
| Candidate abandons a half-filled draft | The draft persists on the conversation, so Riva resumes where it left off on next login — which is the desired behaviour. |
| Page reload after attaching a file, before submitting | The `File` is memory-only, so it is lost. `draft.resume_attached` is true with no live `File`, the widget detects the mismatch, and Riva asks for the file again. Explicit, not silent. |
| Widget submits but the network drops before the response | The application may exist without Riva knowing. The next turn's `get_my_applications` sees it, and a retry hits the endpoint's own **409 duplicate** guard — so a double submission is impossible by construction. |
| In-process event bus is single-worker | Pre-existing (`events.py` documents it). Riva does not make it worse; it publishes nothing new. |

---

## 14. Open decision — please confirm before Phase 1

1. **Markdown rendering.** Plan of record: a small in-house `RivaMarkdown.tsx`
   (escape-then-render, ~120 lines) covering bold, lists, headings, inline code, and links.
   It keeps `package.json` untouched and adds no supply-chain surface. The alternative is
   `react-markdown` (pinned exact), which is more capable but is a new dependency in a repo
   that currently has six. **Say the word if you'd rather have `react-markdown`.**

*(The earlier `source_channel` question is now closed: because the hand-off goes through the
unmodified `POST /applications`, the endpoint sets `source_channel=website` itself. Nothing
to decide, no enum migration. A distinct `chat` channel would require editing that endpoint,
which the boundary rule forbids — so it would be a separate, explicitly-approved task.)*

Everything else in this document is decided and needs no further input.

---

## 15. Ready-state

Design complete. **No `.py`, `.ts`, or `.tsx` file has been created or modified.** The deep
codebase review in §3 is finished; Phase 0 re-verifies it against the live tree. On
"Proceed with the To-Do list" I start at Phase 0 and work down, verifying at each phase
boundary rather than at the end.

**The boundary, in one sentence:** Riva talks, collects, and confirms — then the widget
posts the payload to the existing `POST /applications`, and the existing six agents take it
from there, untouched.

