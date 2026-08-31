# RecruitFlow AI — Backend Documentation

**FastAPI + Python + AI Agents — The Engine Behind Autonomous Recruitment**

---

## Live Deployment

| Resource | URL |
|---|---|
| **Backend API** (Render) | <https://recruitflow-ai-3u84.onrender.com> |
| **Interactive API Docs** (Swagger UI) | <https://recruitflow-ai-3u84.onrender.com/docs> |
| **Health check** | <https://recruitflow-ai-3u84.onrender.com/health> |

> The three frontends this API serves: Career Website & Candidate Portal
> (<https://recruitflow-ai-eta.vercel.app/>), Recruiter Dashboard
> (<https://recruitflow-ai-recruiter-dashboard.vercel.app/>), and Admin Dashboard
> (<https://recruitflow-ai-admin-dashboard.vercel.app/>).

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Technology Stack](#technology-stack)
4. [Project Structure](#project-structure)
5. [API Routers](#api-routers)
6. [The Six AI Agents](#the-six-ai-agents)
7. [Riva — The Candidate Assistant Agent](#riva--the-candidate-assistant-agent)
8. [Services Layer](#services-layer)
9. [Background Workers](#background-workers)
10. [Data Models](#data-models)
11. [Database Migrations](#database-migrations)
12. [Authentication & Security](#authentication--security)
13. [Configuration & Environment](#configuration--environment)
14. [Local Development Setup](#local-development-setup)
15. [Deployment (Render)](#deployment-render)

---

## Overview

The **RecruitFlow Backend** is a production-grade Python API built with FastAPI that powers the entire RecruitFlow AI recruitment automation platform. It exposes REST endpoints for the three frontend portals (candidate, recruiter, admin), orchestrates six specialist AI agents via the OpenAI Agents SDK, manages real-time WebSocket updates, integrates with Google Calendar, Cloudflare R2 object storage and the Resend email API, and coordinates background workers for email intake and scheduled reminders.

**Key Responsibilities:**
- Authentication (custom JWT + Google OAuth 2.0)
- Multi-channel resume intake (website upload, IMAP email polling, Google Forms API)
- AI agent orchestration (resume parsing, scoring, scheduling, email drafting, reply understanding)
- **Riva**, the candidate-facing conversational assistant (7th agent) serving the Candidate Dashboard chat
- Real-time pipeline updates via WebSocket (`/ats/ws`)
- Google Calendar integration (OAuth, free/busy checks, event booking)
- Transactional email sending via the **Resend** HTTPS API (automated email pipelines + notifications)
- Permanent resume & avatar storage in a private **Cloudflare R2** bucket (S3-compatible)
- Background job queue (Celery + Redis)
- Neon PostgreSQL persistence (SQLModel ORM, Alembic migrations)

---

## Architecture

The backend is organized into **five logical layers**:

```
┌─────────────────────────────────────────────────────────────────┐
│  API LAYER (FastAPI Routers)                                    │
│  • /auth — signup, login, logout, refresh, Google OAuth        │
│  • /jobs — job CRUD for recruiters                             │
│  • /applications — apply, mine, shortlist, reject-bulk         │
│  • /interviews — interview details, calendar connect, reply    │
│  • /recruiter — profile, settings                              │
│  • /admin — recruiter/job/candidate management, agent log      │
│  • /ats — pipeline (GET + WebSocket), real-time board          │
│  • /analytics — summary stats (recruiter + admin scoped)       │
│  • /files — resume download, avatar serving                    │
│  • /riva — Riva candidate assistant chat (candidate-only)      │
└─────────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  AGENTIC AI LAYER                                                │
│  • orchestrator_agent.py — entry point, routes via handoff()   │
│  • resume_parser_agent.py — PDF/DOCX → structured JSON         │
│  • scoring_agent.py — candidate vs job (score + explanation)   │
│  • scheduling_agent.py — Google Calendar booking               │
│  • email_agent.py — drafts + sends transactional emails        │
│  • reply_intent_agent.py — reads candidate replies             │
│  • riva_agent.py — candidate chat assistant (7th agent)        │
│  • runner.py — background trigger functions                    │
└─────────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  SERVICES LAYER                                                  │
│  • calendar_service — Google Calendar API wrapper              │
│  • email_service — Resend HTTPS API wrapper                    │
│  • storage_service — Cloudflare R2 storage (boto3)             │
│  • intake_service — resume ingestion entry point               │
│  • resume_extraction — PDF/DOCX text extraction                │
│  • google_oauth — OAuth token exchange + refresh              │
│  • events — WebSocket broadcast helper                         │
└─────────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  WORKERS LAYER (Background Jobs)                                 │
│  • imap_worker — polls inbox for resume emails (Celery)        │
│  • forms_worker — polls Google Forms responses (Celery)        │
│  • reminder_worker — sends interview reminders (APScheduler)   │
│  • scheduler — cron-like job scheduler setup                   │
└─────────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  DATA LAYER                                                      │
│  • models/ — SQLModel table definitions (10 tables)            │
│  • db/session.py — session factory, engine                     │
│  • db/migrations/ — Alembic version control                    │
│  • Neon PostgreSQL — serverless Postgres database              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

| Component | Technology | Version / Details |
|---|---|---|
| **Language** | Python | 3.11 |
| **Web Framework** | FastAPI | 0.116.1 |
| **AI Agents** | OpenAI Agents SDK | 0.19.0 |
| **LLM Proxy** | OpenRouter | `openai/gpt-4o-mini` |
| **Database** | Neon PostgreSQL | Serverless |
| **ORM** | SQLModel + SQLAlchemy | 0.0.21 + 2.0.36 |
| **Migrations** | Alembic | 1.14.1 |
| **Background Jobs** | Celery + Redis | 5.4.0 + 5.2.1 |
| **Auth** | python-jose (JWT) + bcrypt | 3.3.0 + 4.2.1 |
| **Google APIs** | google-api-python-client | 2.149.0 |
| **Resume Parsing** | PyMuPDF + pdfplumber + python-docx | 1.28.0 + 0.11.4 + 1.1.2 |
| **Object Storage** | Cloudflare R2 via boto3 — private bucket, S3-compatible | 1.35.32 |
| **Transactional Email** | Resend HTTPS API — automated email pipelines & notifications | 2.35.0 |
| **ASGI Server** | Uvicorn | 0.34.0 |
| **Deployment** | Render (Docker web service) | Binds `$PORT` |

---

## Project Structure

```
recruitflow-backend/
├── app/
│   ├── __init__.py
│   ├── main.py                     → FastAPI app entrypoint, router mounting, lifespan
│   ├── api/                        → FastAPI routers (REST endpoints)
│   │   ├── __init__.py
│   │   ├── auth.py                 → signup, login, logout, refresh, Google OAuth, /me, profile
│   │   ├── jobs.py                 → job CRUD (recruiter + admin)
│   │   ├── applications.py         → POST /applications, /mine, /shortlist, /reject-bulk, /send-interview
│   │   ├── interviews.py           → interview details, calendar connect, OAuth callback, /reply
│   │   ├── recruiter.py            → recruiter profile/settings
│   │   ├── admin.py                → recruiter/job/candidate management
│   │   ├── ats.py                  → GET /ats/pipeline, WebSocket /ats/ws
│   │   ├── analytics.py            → /analytics/summary, /admin/analytics/summary
│   │   ├── files.py                → resume download, avatar serving
│   │   └── riva.py                 → Riva chat routes (candidate-only)
│   ├── agents/                     → Six AI agents (OpenAI Agents SDK)
│   │   ├── __init__.py
│   │   ├── llm_config.py           → OpenRouter setup, set_default_openai_client()
│   │   ├── orchestrator_agent.py   → entry point, handoff() to specialists
│   │   ├── resume_parser_agent.py  → extracts structured data from resume text
│   │   ├── scoring_agent.py        → scores candidate vs job description
│   │   ├── scheduling_agent.py     → Google Calendar booking/rescheduling
│   │   ├── email_agent.py          → drafts + sends transactional emails
│   │   ├── reply_intent_agent.py   → classifies candidate email replies
│   │   ├── riva_agent.py           → Riva, the candidate chat assistant (7th agent)
│   │   ├── riva_context.py         → Riva's trusted run context (user, conversation)
│   │   ├── riva_runner.py          → runs one Riva turn, logs it to agent_runs
│   │   ├── schemas.py              → Pydantic schemas for agent tool inputs
│   │   ├── context.py              → shared agent context (application_id, session, etc.)
│   │   └── runner.py               → background trigger functions (run_intake_bg, run_reply_bg)
│   ├── models/                     → SQLModel table definitions
│   │   ├── __init__.py
│   │   ├── user.py                 → users table (admin/recruiter/candidate)
│   │   ├── recruiter_profile.py    → recruiter settings, Google refresh token
│   │   ├── job.py                  → job postings
│   │   ├── candidate.py            → applicant records, parsed_data (JSONB)
│   │   ├── application.py          → candidate ↔ job link, score, status
│   │   ├── interview.py            → google_event_id, scheduled times, status
│   │   ├── email_log.py            → every email sent
│   │   ├── chat.py                 → Riva conversations + messages
│   │   └── agent_run.py            → audit trail of all agent executions
│   ├── services/                   → Business logic + external integrations
│   │   ├── __init__.py
│   │   ├── calendar_service.py     → Google Calendar API (OAuth, free/busy, CRUD events)
│   │   ├── email_service.py        → Resend HTTPS API sending + template rendering
│   │   ├── storage_service.py      → Cloudflare R2 upload/download (boto3), local-disk fallback
│   │   ├── intake_service.py       → resume ingestion entry point
│   │   ├── resume_extraction.py    → PDF/DOCX text extraction (PyMuPDF, pdfplumber, python-docx)
│   │   ├── google_oauth.py         → OAuth token exchange + refresh logic
│   │   └── events.py               → WebSocket broadcast helper
│   ├── workers/                    → Background job workers (Celery + APScheduler)
│   │   ├── __init__.py
│   │   ├── imap_worker.py          → polls inbox for resume emails (Celery task)
│   │   ├── forms_worker.py         → polls Google Forms responses (Celery task)
│   │   ├── reminder_worker.py      → sends interview reminders (APScheduler)
│   │   └── scheduler.py            → APScheduler setup
│   ├── core/                       → Security + dependencies
│   │   ├── __init__.py
│   │   ├── deps.py                 → get_current_user, require_role (FastAPI dependencies)
│   │   ├── security.py             → JWT encode/decode, password hashing
│   │   ├── crypto.py               → encrypt/decrypt Google refresh tokens
│   │   └── rate_limit.py           → rate limiting decorator
│   └── db/                         → Database session + migrations
│       ├── __init__.py
│       ├── session.py              → engine, get_session() dependency
│       └── migrations/             → Alembic version control
│           ├── env.py
│           └── versions/
│               ├── 1c27c78fde99_initial_schema.py
│               ├── b2f4a1c9d3e7_add_user_picture_gender.py
│               └── c7a3e9b15d24_add_chat_tables.py
├── Dockerfile                      → container image (Render + local docker run)
├── .dockerignore                   → keeps venv/caches/secrets out of the image
├── render.yaml                     → Render Blueprint (Docker web service, env vars)
├── requirements.txt                → 28 production dependencies
├── alembic.ini                     → Alembic config
├── docs/                           → Agent instructions documentation
├── scripts/                        → Utility scripts
└── storage/                        → Local file storage (dev fallback when R2 is unconfigured)
```

---

## API Routers

All routers are mounted in `app/main.py` and protected by role-based FastAPI dependencies (`get_current_user`, `require_role`). Auth uses portal-scoped httpOnly cookies, disambiguated by the `X-Portal` request header.

### `auth.py` — Authentication (`/auth`)

| Method | Endpoint | Role | Purpose |
|---|---|---|---|
| `POST` | `/auth/signup` | Public | Candidate self-registration (rate-limited) |
| `POST` | `/auth/login` | Public | Email/password login, sets access + refresh cookies (rate-limited) |
| `POST` | `/auth/refresh` | Cookie | Silent token refresh; reads `X-Portal` to pick the right cookie |
| `POST` | `/auth/logout` | Cookie | Clears all three portal cookie pairs |
| `GET` | `/auth/google` | Public | Builds Google OAuth consent URL |
| `GET` | `/auth/google/callback` | Public | Exchanges code, creates/links user, stores `picture_url`, redirects to `/portal` |
| `GET` | `/auth/me` | Any | Returns current user (incl. `picture_url`, `gender`) |
| `PATCH` | `/auth/profile` | Any | Updates gender (drives default avatar) |
| `POST` | `/auth/profile/picture` | Any | Uploads avatar to storage, sets `picture_url` |

**Role-scoped cookies:** `_cookie_names_for_role()` returns `(candidate_access_token, candidate_refresh_token)` / `recruiter_*` / `admin_*`, keeping the three portal sessions fully isolated on the same browser.

### `jobs.py` — Job Management (`/jobs`)

| Method | Endpoint | Role | Purpose |
|---|---|---|---|
| `POST` | `/jobs` | Recruiter | Create a job posting |
| `GET` | `/jobs` | Public | List open jobs (career site) |
| `GET` | `/jobs/{id}` | Public | Job detail |
| `GET` | `/jobs/mine/list` | Recruiter | Recruiter's own jobs |
| `PUT` | `/jobs/{id}` | Recruiter | Update a job |
| `DELETE` | `/jobs/{id}` | Recruiter | Delete a job |

### `applications.py` — Applications (`/applications`)

| Method | Endpoint | Role | Purpose |
|---|---|---|---|
| `POST` | `/applications` | Public/Candidate | Submit application + resume (multipart); triggers intake → agents |
| `GET` | `/applications/mine` | Candidate | Candidate's own applications |
| `POST` | `/applications/{id}/shortlist` | Recruiter | Move to shortlisted |
| `POST` | `/applications/reject-bulk` | Recruiter | Bulk reject → Email Agent per candidate |
| `POST` | `/applications/{id}/send-interview` | Recruiter | Trigger Scheduling + Email agents |
| `GET` | `/applications/qualified/list` | Recruiter | Candidates above score cutoff |

### `interviews.py` — Interviews & Calendar (`/interviews`)

| Method | Endpoint | Role | Purpose |
|---|---|---|---|
| `GET` | `/interviews/by-application/{id}` | Any | Single interview for a detail panel |
| `GET` | `/interviews/my` | Candidate | Candidate's own interviews (matched by user_id or email) |
| `GET` | `/interviews/recruiter` | Recruiter/Admin | All interviews across owned jobs (admins see all) |
| `GET` | `/interviews/calendar/connect` | Recruiter | Google Calendar OAuth consent URL |
| `GET` | `/interviews/calendar/callback` | Public | Stores encrypted refresh token on recruiter profile |
| `POST` | `/interviews/reply` | Recruiter/Admin | Feeds candidate reply into Reply Intent Agent |

### `recruiter.py` — Recruiter Profile (`/recruiter`)

| Method | Endpoint | Role | Purpose |
|---|---|---|---|
| `GET` | `/recruiter/profile` | Recruiter | Profile + settings (working hours, calendar status) |
| `PUT` | `/recruiter/profile` | Recruiter | Update company name, working hours |

### `admin.py` — Admin Management (`/admin`)

| Method | Endpoint | Role | Purpose |
|---|---|---|---|
| `GET` | `/admin/recruiters` | Admin | List all recruiters |
| `POST` | `/admin/recruiters` | Admin | Create recruiter with generated temp password |
| `PATCH` | `/admin/recruiters/{id}` | Admin | Disable/re-enable a recruiter |
| `GET` | `/admin/jobs` | Admin | Every job across all recruiters |
| `GET` | `/admin/candidates` | Admin | Every candidate record |
| `PUT` | `/admin/candidates/{id}` | Admin | Edit candidate details |
| `DELETE` | `/admin/candidates/{id}` | Admin | Delete a candidate |
| `GET` | `/admin/agent-runs` | Admin | Searchable agent activity log |

### `ats.py` — Real-Time Pipeline (`/ats`)

| Method | Endpoint | Role | Purpose |
|---|---|---|---|
| `GET` | `/ats/pipeline` | Recruiter/Admin | Full joined application data, filterable |
| `WS` | `/ats/ws` | Recruiter/Admin | Live WebSocket event stream for board updates |

Filters: `job_id`, `status`, `source_channel`, `min_score`, `max_score`.

### `analytics.py` — Analytics (`/analytics`)

| Method | Endpoint | Role | Purpose |
|---|---|---|---|
| `GET` | `/analytics/summary` | Recruiter | Recruiter-scoped KPIs |
| `GET` | `/analytics/admin/summary` | Admin | Global KPIs |

Returns: total applications, shortlisted, interview pipeline, hired, recruitment progress %, average score, active openings, time-to-hire, and a `by_status` breakdown.

### `files.py` — File Serving (`/files`)

| Method | Endpoint | Role | Purpose |
|---|---|---|---|
| `GET` | `/files/avatars/{name}` | Public | Serves avatars (unauthenticated so `<img>` tags work) |
| `GET` | `/files/{key:path}` | Recruiter/Admin | Authenticated resume download — bytes are streamed from the private Cloudflare R2 bucket, never a public URL |

> The avatar route is deliberately declared **before** the catch-all so candidate profile images don't 401.

### `riva.py` — Riva Candidate Assistant (`/riva`)

Every route is locked to a signed-in candidate via `require_role(UserRole.candidate)` — a
recruiter or admin cookie gets **403**, no cookie gets **401**. `POST /riva/messages` is
additionally rate-limited **per user** (20 turns/minute), since each turn costs an LLM call.

| Method | Endpoint | Role | Purpose |
|---|---|---|---|
| `GET` | `/riva/conversation` | Candidate | The candidate's rolling conversation + full transcript |
| `POST` | `/riva/messages` | Candidate | Send one message, get Riva's reply (+ a `submission` hand-off object when the draft is ready) |
| `POST` | `/riva/outcome` | Candidate | The browser reports the result of the real application submission so Riva can acknowledge it |
| `DELETE` | `/riva/conversation` | Candidate | Clear the transcript and draft, start over |

> **No file upload here, by design.** Riva never receives résumé bytes and never creates an
> application. The only route that accepts a résumé is the pre-existing `POST /applications`.

---

## The Six AI Agents

All agents are built on the **OpenAI Agents SDK** and configured (in `llm_config.py`) to route through the **OpenRouter** proxy using the `openai/gpt-4o-mini` model. The SDK's tracing is disabled and the default client/API are set to `chat_completions`. Each agent defines **function tools** (decorated Python functions the model may call) and **instructions** (its system prompt). Agents never run from the frontend directly — they're triggered by FastAPI background tasks via `runner.py`, and every run is logged to `agent_runs`.

### 1. Orchestrator Agent (`orchestrator_agent.py`)
The entry point for every workflow. It inspects the task (new resume vs inbound reply) and uses `handoff()` to route to the correct specialist. It owns no business logic itself — it is pure routing, mirroring how a recruitment team lead delegates.

### 2. Resume Parser Agent (`resume_parser_agent.py`)
Receives raw resume text (already extracted from PDF/DOCX by `resume_extraction.py`) and produces structured data: name, email, phone, education, skills, certifications, years of experience, previous employers, current location, LinkedIn/portfolio URLs.

**Tools:**
- `save_parsed_candidate()` — writes Pydantic-schema-validated data to `candidates.parsed_data`, sets `applications.status = parsed`
- `flag_low_confidence_extraction()` — marks extractions the model is unsure about for human review

### 3. Scoring Agent (`scoring_agent.py`)
Evaluates a parsed candidate against a specific job description across: required skills, technical experience, years of experience, industry experience, certifications, education, language requirements, and location preference.

**Tools:**
- `get_job_description()` — fetches the target job's description and required skills
- `save_score()` — writes `{score, classification, explanation}`, sets `applications.status = scored`

**Classification bands:** 90–100 Highly Recommended · 75–89 Recommended · 60–74 Consider · <60 Not Recommended.

### 4. Scheduling Agent (`scheduling_agent.py`)
Manages the recruiter's Google Calendar. Finds open slots inside working hours (default 9:00–17:00), books events, and reschedules or cancels on demand.

**Tools:**
- `get_free_busy()` — queries the recruiter's calendar for availability inside working hours
- `book_interview()` — creates a calendar event + a `proposed` `interviews` row, stores `google_event_id`
- `reschedule_interview()` — cancels the old slot, books a new one
- `cancel_interview()` — cancels the calendar event, records the reason

### 5. Email Agent (`email_agent.py`)
Owns every outbound transactional email. Renders one of six branded HTML templates and sends them through the **Resend** HTTPS API, which drives all automated email pipelines and notifications.

**Tools:**
- `render_email_template()` — fills a branded template with candidate/job data
- `send_email()` — sends via the Resend HTTPS API
- `log_email()` — writes a row to `email_logs`

**Templates:** Application Confirmation · Shortlisting Notification · Interview Invitation · Reminder · Offer Letter Notification · Rejection.

### 6. Reply Intent Agent (`reply_intent_agent.py`)
Reads an inbound candidate email reply (from the IMAP worker or the `/interviews/reply` endpoint) and classifies the candidate's intent, then hands off to Scheduling + Email agents.

**Tools:**
- `classify_reply_intent()` — returns `confirm`, `decline_permanently`, or `needs_reschedule`
- `write_explanation_note()` — records reasoning into `interviews.cancellation_reason`

**Behaviour by intent:**
- `confirm` → set `interviews.status = confirmed`, no calendar change
- `decline_permanently` → Scheduling Agent cancels event, note saved, raw reply → `last_candidate_reply`
- `needs_reschedule` → Scheduling Agent cancels old slot, books new one

In all three cases the Email Agent sends a follow-up confirming the outcome, and a real-time update is pushed to the recruiter dashboard.

### Supporting Files
- **`runner.py`** — background trigger functions (`run_intake_bg`, `run_reply_bg`) invoked by FastAPI `BackgroundTasks`
- **`context.py`** — shared context object (application_id, DB session) threaded through agent tool calls
- **`schemas.py`** — Pydantic models validating every agent tool's input/output
- **`llm_config.py`** — OpenRouter client setup, model selection, tracing config

---

## Riva — The Candidate Assistant Agent

**Riva** is the platform's **7th agent** and the only candidate-facing one: a conversational
career assistant that powers the chat widget in the **Candidate Dashboard** of
`recruitflow-website`. She is built on the same OpenAI Agents SDK and the same
`get_agent_model()` LLM wiring as the other six, but she is **deliberately isolated** from
them.

### Strict Separation

Riva imports **nothing** from `orchestrator_agent.py`, `resume_parser_agent.py`,
`scoring_agent.py`, `scheduling_agent.py`, `email_agent.py`, `reply_intent_agent.py`,
`runner.py`, `context.py`, `intake_service.py`, or `storage_service.py`. She has her own
agent, context, and runner modules, reads only `Job`, `Application`, `Candidate` and her own
chat tables, and never calls `Runner.run` on another agent. The six recruiter-facing agents
are untouched by her existence, and she has no relationship with the recruiter or admin
dashboards.

### Tools (`riva_agent.py`)

All tools are sync, flat-parameter, string-returning, and open their own `Session(engine)`.
Every identity they act on comes from the trusted `RivaContext` (`riva_context.py`) — built
server-side from the JWT cookie — never from model arguments, so Riva can only ever read the
signed-in candidate's own data.

| Tool | Purpose |
|---|---|
| `list_open_jobs()` | All currently **open** jobs the candidate can apply to |
| `get_job_details(job_query)` | Resolves one open job by title or id → full description + required skills |
| `get_my_applications()` | The candidate's **own** applications with status and applied date |
| `save_application_draft(full_name, years_experience, job_query)` | Merges collected fields into `chat_conversations.draft`; resolves `job_query` to a real open `job_id` and refuses unknown roles |
| `request_confirmation()` | Returns the draft plus what is still missing, so Riva can read it back before asking for a yes |
| `mark_ready_to_submit()` | Flips `draft.ready` — **writes no application**; refuses while job, name, or résumé is missing |

### She Cannot Submit — By Construction

Riva has **no tool that can create an application**, so even a fully jailbroken prompt cannot
make one. `mark_ready_to_submit()` only sets a flag; `POST /riva/messages` turns that flag
into a `submission` object `{job_id, full_name, email, job_title}` in the HTTP response, and
the **browser** then performs the ordinary apply request against the existing
`POST /applications` endpoint — same route, same multipart payload, same candidate cookie as
the public web form — carrying the résumé file it has held in memory all along. From the
backend's point of view a Riva application is indistinguishable from a web-form one, and it
triggers the same unchanged six-agent pipeline. The candidate's browser then calls
`POST /riva/outcome` so Riva can confirm the result (or explain a duplicate/closed-job error)
in chat.

### Turn Lifecycle (`riva_runner.py`)

`run_riva_turn()` builds a fresh agent per turn, feeds it a trusted preamble plus a bounded
window of the recent transcript, and awaits `Runner.run(...)` inside the request — the
candidate is waiting for the reply, so no background work is spawned. LLM or provider
failures are caught and turned into a graceful apology message rather than a 500, and every
turn is logged to `agent_runs` under `agent_name="Riva"`, so Riva's activity shows up
in the Admin Dashboard's agent log automatically.

### Persistence

Two tables (`app/models/chat.py`) hold the conversation, so the transcript and any
half-finished draft survive logout: `chat_conversations` (one per candidate, plus the JSON
`draft`) and `chat_messages` (the `user`/`assistant` transcript). The résumé is **never**
stored here — only its filename, as a marker that an attachment exists in the browser.

---

## Services Layer

The `services/` directory holds all business logic and external integrations, keeping routers thin and agents focused on decisions rather than plumbing.

| Service | Responsibility |
|---|---|
| **calendar_service.py** | Google Calendar API wrapper — builds OAuth consent URLs, exchanges codes for refresh tokens, encrypts/decrypts tokens, queries free/busy, and creates/updates/cancels events. Exposes `is_configured()` so routers can 503 gracefully when credentials are absent. |
| **email_service.py** | Renders branded HTML templates and sends them via the **Resend** HTTPS API — the transport behind every automated email pipeline and notification (Render blocks outbound SMTP, so HTTPS delivery is the reliable path). Central place for all outbound mail. |
| **storage_service.py** | **Cloudflare R2** object storage via boto3 (S3-compatible, private bucket) — `store_avatar()`, `store_resume()`, `read_file()`, `public_url()`. Gives résumés and avatars permanent, secure storage that survives Render redeploys; falls back to local disk when R2 credentials are absent so local development needs none. |
| **intake_service.py** | The single `ingest_resume(file, metadata)` entry point used by every intake channel (website, email, forms, LinkedIn). Stores the file in R2, creates candidate + application records, and hands off to the Orchestrator Agent. |
| **resume_extraction.py** | Extracts raw text from PDF (PyMuPDF/pdfplumber) and DOCX (python-docx) before the Resume Parser Agent runs. |
| **google_oauth.py** | Shared OAuth token exchange + refresh logic for both candidate login and recruiter calendar. |
| **events.py** | WebSocket broadcast helper — pushes pipeline updates to all connected `/ats/ws` clients whenever an application changes. |

---

## Background Workers

Workers run outside the request/response cycle to handle polling and scheduled jobs.

| Worker | Engine | Responsibility |
|---|---|---|
| **imap_worker.py** | Celery | Polls the configured inbox, extracts sender + resume attachment, calls `ingest_resume()` with `source_channel=email` (or `linkedin`). Dormant until IMAP credentials are supplied. |
| **forms_worker.py** | Celery | Polls Google Forms/Sheets responses, ingests each as `source_channel=google_form`. Dormant until service-account credentials are supplied. |
| **reminder_worker.py** | APScheduler | Sends the Interview Reminder email 24 hours before each scheduled interview. |
| **scheduler.py** | APScheduler | Sets up and starts the scheduled-job registry during app lifespan. |

---

## Data Models

Ten SQLModel tables under `app/models/`. All primary keys are UUIDs; timestamps are `created_at`/`updated_at`.

| Model | Key Fields |
|---|---|
| **user.py** | `role` (admin/recruiter/candidate), `email` (unique), `password_hash`, `google_id`, `full_name`, `picture_url`, `gender`, `created_by_admin_id`, `is_active` |
| **recruiter_profile.py** | `user_id` (FK), `company_name`, `working_hours_start/end`, `google_calendar_connected`, `google_refresh_token` (encrypted) |
| **job.py** | `recruiter_id` (FK), `title`, `description`, `required_skills` (JSONB), `status` (open/closed/draft) |
| **candidate.py** | `user_id` (nullable FK), contact fields, `resume_file_url`, `source_channel`, `parsed_data` (JSONB) |
| **application.py** | `candidate_id` (FK), `job_id` (FK), `score`, `classification`, `score_explanation`, `status`, `recruiter_decision_by` |
| **interview.py** | `application_id` (FK), `google_event_id`, `scheduled_start/end`, `status`, `cancellation_reason`, `last_candidate_reply` |
| **email_log.py** | `application_id` (FK), `type`, `sent_at`, `status` (sent/failed/replied) |
| **agent_run.py** | `agent_name`, `application_id` (nullable FK), `input_summary`, `output_summary`, `handed_off_to`, `status` |

### Riva Chat Tables (`chat.py`)

Two additional tables added with the Riva assistant. They are **purely additive** — no
existing table, column, or enum was altered to introduce them.

| Table | Key Fields |
|---|---|
| **chat_conversations** | `id` (UUID PK), `user_id` (FK → users, indexed), `draft` (JSON — the in-flight application draft), `created_at`/`updated_at` |
| **chat_messages** | `id` (UUID PK), `conversation_id` (FK → chat_conversations, indexed), `role` (`user` / `assistant`), `content`, `created_at` |

### Application Status Lifecycle
```
received → parsed → scored → shortlisted ─┬─▶ interview_scheduled → interview_completed → offer → hired
                                          └─▶ rejected
```

---

## Database Migrations

Schema is version-controlled with **Alembic** (`app/db/migrations/`).

| Revision | Description |
|---|---|
| `1c27c78fde99` | Initial schema — all ten core tables |
| `b2f4a1c9d3e7` | Adds `picture_url` and `gender` columns to `users` |
| `c7a3e9b15d24` | Adds the Riva chat tables — `chat_conversations` and `chat_messages` |

**Common commands:**
```bash
alembic upgrade head          # apply all pending migrations
alembic revision --autogenerate -m "message"   # create a new migration
alembic downgrade -1          # roll back one revision
alembic current               # show current DB revision
```

> If Google login fails with `column users.picture_url does not exist`, run `alembic upgrade head` — the `b2f4a1c9d3e7` migration adds those columns.

---

## Authentication & Security

- **JWT** — 15-minute access token + 7-day refresh token, both httpOnly, Secure, SameSite cookies (`core/security.py`)
- **Portal-scoped cookies** — `candidate_`/`recruiter_`/`admin_` prefixes isolate the three sessions; the `X-Portal` header tells `/auth/refresh` which pair to read
- **Password hashing** — bcrypt/argon2, never plaintext
- **Google OAuth** — candidate login + recruiter calendar; refresh tokens encrypted at rest (`core/crypto.py`)
- **Role guards** — `require_role(UserRole.recruiter, UserRole.admin)` enforced server-side on every protected endpoint (`core/deps.py`)
- **Rate limiting** — auth endpoints throttled (`core/rate_limit.py`)
- **File validation** — PDF/DOCX only, size-limited, magic-byte content sniffing on every intake channel
- **Private R2 bucket** — résumés and avatars are never publicly addressable; résumé bytes are read from Cloudflare R2 and streamed back only through the cookie-authenticated `GET /files/{key}` route, restricted to recruiters and admins (`api/files.py`)

---

## Configuration & Environment

Secrets are supplied via environment variables (Render service environment variables in production; `.env` locally — never committed).

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `OPENROUTER_API_KEY` | LLM access for all six agents |
| `JWT_SECRET` | Signing secret for access/refresh tokens |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Candidate login + recruiter calendar OAuth |
| `GOOGLE_REDIRECT_URI` | Candidate-login OAuth callback (e.g. `https://recruitflow-ai-3u84.onrender.com/auth/google/callback`) |
| `GOOGLE_CALENDAR_REDIRECT_URI` | Recruiter calendar-connect OAuth callback (e.g. `https://recruitflow-ai-3u84.onrender.com/interviews/calendar/callback`) |
| `BACKEND_URL` | This service's public base URL (e.g. `https://recruitflow-ai-3u84.onrender.com`) — used as the calendar redirect fallback |
| `RECRUITER_DASHBOARD_URL` | Recruiter dashboard origin the calendar callback returns to (e.g. `https://recruitflow-ai-recruiter-dashboard.vercel.app`) |
| `APP_TIMEZONE` | Business timezone (IANA name, e.g. `Australia/Sydney`) recruiter working hours are anchored in; defaults to UTC |
| `TOKEN_ENCRYPTION_KEY` | Encrypts stored Google refresh tokens |
| `R2_ACCOUNT_ID` | Cloudflare account id — the R2 S3 endpoint is derived from it (`https://<id>.r2.cloudflarestorage.com`) |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | Cloudflare R2 API token credentials |
| `R2_BUCKET_NAME` | Private R2 bucket holding résumés and avatars. When all four `R2_*` vars are set, uploads go to R2; otherwise the service falls back to `LOCAL_STORAGE_DIR` (dev only) |
| `LOCAL_STORAGE_DIR` | Local-disk fallback directory when R2 is unconfigured (defaults to `./storage`) |
| `RESEND_API_KEY` | Resend HTTPS email API key — powers every automated email pipeline and notification (Render blocks outbound SMTP, so HTTPS delivery is required) |
| `EMAIL_FROM` | Verified Resend sender address for outbound email (defaults to `onboarding@resend.dev`) |
| `SMTP_*` / `GMAIL_*` | Legacy email sending credentials — unused in production (Render blocks SMTP ports) |
| `IMAP_*` | Email intake mailbox credentials |
| `REDIS_URL` | Celery broker/backend (only if running Celery separately) |
| `FRONTEND_ORIGINS` | Comma-separated production frontend origins for CORS (the three Vercel domains) |
| `PORT` | Injected automatically by Render — the app binds to it |

---

## Local Development Setup

```bash
# 1. Create and activate a virtual environment
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS/Linux

# 2. Install dependencies
pip install -r requirements.txt

# 3. Create .env with the variables above

# 4. Apply database migrations
alembic upgrade head

# 5. Run the API (hot reload)
uvicorn app.main:app --reload --port 7860
```

Interactive API docs are then available at `http://localhost:7860/docs`.

To run background workers (optional, requires Redis):
```bash
celery -A app.workers worker --loglevel=info
```

---

## Deployment (Render)

The backend deploys to **Render** as a **Docker web service**. Render runs a
persistent container, so every feature works as designed — the `/ats/ws`
WebSocket, the in-process intake scheduler, and the event bus all run normally.

The repo ships a `render.yaml` Blueprint and a `Dockerfile`. The container binds
to the `$PORT` Render injects at runtime:

```dockerfile
# Dockerfile (summary)
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 7860
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-7860}
```

**Deployment steps:**
1. Push `recruitflow-backend` to GitHub.
2. In Render, **New → Blueprint** and point it at the repo — Render reads
   `render.yaml` and provisions a Docker web service with a `/health` health check.
   (Or **New → Web Service**, choose the repo, and select the **Docker** runtime.)
3. Add every environment variable from the table above under the service's
   **Environment** tab (they're declared `sync: false` in `render.yaml`, so Render
   prompts for each). Set `FRONTEND_ORIGINS` to your three Vercel domains
   (`https://recruitflow-ai-eta.vercel.app`,
   `https://recruitflow-ai-recruiter-dashboard.vercel.app`,
   `https://recruitflow-ai-admin-dashboard.vercel.app`) and
   `GOOGLE_REDIRECT_URI` to `https://recruitflow-ai-3u84.onrender.com/auth/google/callback`.
   Set the four `R2_*` variables too — Render's container filesystem is ephemeral, so
   without Cloudflare R2 any uploaded résumé is lost on the next redeploy or restart.
   `RESEND_API_KEY` is likewise required for outbound email, since Render blocks SMTP ports.
4. Deploy — Render builds the Dockerfile and starts Uvicorn on `$PORT`. On first
   boot the lifespan handler creates tables and starts the intake scheduler.
5. Point the three frontends' `NEXT_PUBLIC_API_URL` at the Render service URL
   (`https://recruitflow-ai-3u84.onrender.com`). The live API and its interactive
   docs are then available at <https://recruitflow-ai-3u84.onrender.com> and
   <https://recruitflow-ai-3u84.onrender.com/docs>.

### Free-plan cold starts

On Render's **free** plan the service spins down after ~15 minutes of inactivity
and takes **~40–60 seconds** to wake on the next request. During that window
Render's router returns `502/503/504` or refuses the connection.

The frontends handle this transparently: their API client (`lib/api.ts`) wraps
every request in a **cold-start–resilient fetch** that retries patiently (up to
~90s) instead of surfacing a "504 Gateway Timeout" or "Network Error", and shows
a brief **"Waking up the server…"** banner while it waits. No user-facing errors
during warm-up. To avoid cold starts entirely, upgrade to a paid Render instance
or ping `/health` on a schedule with an external uptime monitor.

---

<div align="center">

**RecruitFlow AI™ Backend** — FastAPI · OpenAI Agents SDK · Neon PostgreSQL · Cloudflare R2 · Resend

*© 2026 Sahir Ahmed Sheikh — BranDive Media Solutions. All rights reserved.*

</div>