<div align="center">

# RecruitFlow AI™

### AI Recruitment & Candidate Screening Automation System

*From resume to signed offer — an agentic hiring pipeline that runs itself.*

[![Backend](https://img.shields.io/badge/Backend-FastAPI%20%2B%20Python-009688?logo=fastapi&logoColor=white)](#)
[![Frontend](https://img.shields.io/badge/Frontend-Next.js%2016%20%2B%20TypeScript-000000?logo=nextdotjs&logoColor=white)](#)
[![Database](https://img.shields.io/badge/Database-Neon%20PostgreSQL-00E599?logo=postgresql&logoColor=white)](#)
[![AI](https://img.shields.io/badge/AI-OpenAI%20Agents%20SDK-412991?logo=openai&logoColor=white)](#)
[![License](https://img.shields.io/badge/License-Proprietary-red)](#)

</div>

---

## Deployment URLs

| Surface | Description | URL |
|---|---|---|
| **Career Website & Candidate Portal** | Public job site + candidate dashboard | `_TBD_` |
| **Recruiter Dashboard** | Pipeline, scoring, interview control | `_TBD_` |
| **Admin Dashboard** | Global oversight, recruiter & job management | `_TBD_` |
| **Backend API** | FastAPI REST + WebSocket (Render) | `_TBD_` |
| **API Docs (Swagger)** | Interactive OpenAPI reference | `_TBD_/docs` |

> Deployment URLs will be filled in once the Vercel projects and Render service go live.

---

## Table of Contents

1. [Introduction](#introduction)
2. [The Problem & The Product](#the-problem--the-product)
3. [What RecruitFlow AI Does](#what-recruitflow-ai-does)
4. [System Architecture](#system-architecture)
5. [The Six AI Agents](#the-six-ai-agents)
6. [End-to-End Workflow](#end-to-end-workflow)
7. [Technology Stack](#technology-stack)
8. [Repository Layout](#repository-layout)
9. [Data Model](#data-model)
10. [Security](#security)
11. [Per-Repository Documentation](#per-repository-documentation)
12. [Author & Credits](#author--credits)

---

## Introduction

**RecruitFlow AI™** is a production-grade, AI-powered recruitment automation platform that takes a hiring pipeline from the moment a resume arrives all the way to a scheduled interview and signed offer — with autonomous AI agents handling the repetitive judgment work and humans staying firmly in control of every decision that matters.

RecruitFlow AI is not a single-purpose tool — it is a **complete, end-to-end hiring platform** that serves everyone in the recruitment relationship. Candidates discover and apply to roles and track their progress in real time. Recruiters post jobs, receive applicants from every channel, and identify top talent effortlessly. Admins govern the entire operation. Rather than a monolithic "AI screener," the platform is built as a **team of specialist agents** — each an expert at one task — coordinated by an orchestrator, exactly the way a real recruitment team divides labour.

The platform spans **three role-specific dashboards** (Candidate, Recruiter, Admin), a **public career website**, and a **Python agentic backend**, all wired together with real-time updates so that the instant an agent scores a candidate, the recruiter sees it move across the pipeline board.

---

## The Problem & The Product

Hiring is broken on **both sides of the table**. Recruiters are buried in unstructured resumes and manual busywork; candidates are lost in opaque processes with no visibility and slow, inconsistent communication. Most tools solve a sliver of this — an applicant tracker here, a job board there, an AI screener bolted on somewhere else — leaving everyone to stitch the pieces together.

**RecruitFlow AI is a complete hiring platform.** It is not built to solve one problem for one role. It brings the entire hiring lifecycle — job posting, discovery, application, screening, scoring, shortlisting, scheduling, communication, and offer — into a single, real-time, AI-powered system that delivers value to **candidates, recruiters, and administrators** alike.

### The Problems It Solves

**For Recruiters & Hiring Teams**
- **Resume overload** — hundreds of applications per role arrive across email, career sites, LinkedIn, and web forms, with no consistent structure.
- **Manual triage** — recruiters lose hours opening attachments, copying details into spreadsheets, and eyeballing fit.
- **Inconsistent, biased screening** — human judgment varies by mood, fatigue, and time pressure.
- **Scheduling ping-pong** — booking interviews means endless back-and-forth over email and calendars.
- **Communication drag** — every confirmation, rejection, and reminder is written and sent by hand.
- **No single source of truth** — candidate data, notes, and statuses scatter across tools.
- **Fragmented job management** — posting roles and tracking their applicants lives in separate systems.

**For Candidates**
- **Hard-to-find opportunities** — roles are buried across job boards with clunky, repetitive application forms.
- **Application black holes** — after applying, candidates hear nothing and have zero visibility into their status.
- **Slow, inconsistent communication** — interview invites and updates arrive late, if at all.
- **Painful scheduling** — coordinating an interview time is a manual chore for the candidate too.

**For Administrators & Organizations**
- **No oversight** — leadership can't see the whole pipeline, every recruiter, or every job at once.
- **No accountability** — when automation acts, there's no audit trail explaining what happened and why.
- **Manual user management** — provisioning and governing recruiter accounts is ad hoc.

### The Complete Solution

RecruitFlow AI addresses **all** of the above as one cohesive product:

**A public career website** where candidates discover open roles and apply in one click with a resume — no lengthy forms, and a Google sign-in for instant access.

**A candidate portal** that ends the application black hole: candidates track every application through a live status pipeline, see scheduled interviews with times and details, manage their profile and avatar, and browse and apply to more roles — all in real time.

**Multi-channel intake** that meets applicants wherever they are — career site, email inbox (IMAP), LinkedIn forwarding, and Google Forms — funnelling every resume into one pipeline.

**An agentic AI screening engine** that removes triage entirely: it parses each resume into structured data, scores every candidate against the specific job with a transparent 0–100 rating and a written explanation, and surfaces a ranked, filterable pipeline to the recruiter the instant scoring completes.

**A recruiter dashboard** that is a full hiring cockpit — post and manage jobs, watch applications flow across a live pipeline board, open a rich candidate detail view, and act with one click: shortlist, bulk-reject, or send an interview invitation. When a recruiter decides, the agents draft the email, check Google Calendar for a free slot inside working hours, book the meeting, and even read the candidate's email reply to confirm, reschedule, or cancel — automatically.

**An admin dashboard** for full governance — provision and manage recruiters, oversee every job and candidate across the organization, watch the unfiltered global pipeline, and audit every single AI agent action through a searchable activity log.

**Real-time everything** — WebSocket-powered updates mean a status change made by an agent appears on the recruiter's board and the candidate's portal within milliseconds.

The result is a platform where **candidates get discovered and stay informed**, **recruiters find great people without the busywork**, and **AI does the reading, ranking, scheduling, and writing while humans do the deciding** — with administrators holding the whole operation to account.

### Platform Map — Every Stakeholder, Every Solution

The diagram below shows how RecruitFlow AI serves all three stakeholders from one platform, and which problem each capability solves.

```
                              ┌───────────────────────────────────┐
                              │          RecruitFlow AI™           │
                              │     Complete Hiring Platform       │
                              └───────────────────────────────────┘
                                              │
        ┌─────────────────────────────────────┼─────────────────────────────────────┐
        ▼                                     ▼                                     ▼
┌───────────────────┐             ┌───────────────────────┐             ┌───────────────────────┐
│    CANDIDATE      │             │      RECRUITER        │             │        ADMIN          │
│  (Website+Portal) │             │     (Dashboard)       │             │      (Dashboard)      │
├───────────────────┤             ├───────────────────────┤             ├───────────────────────┤
│ Discover jobs     │             │ Post & manage jobs    │             │ Manage recruiters     │
│  → hard-to-find   │             │  → fragmented mgmt    │             │  → manual user mgmt   │
│ 1-click apply     │             │ Multi-channel intake  │             │ Govern all jobs       │
│  → clunky forms   │             │  → resume overload    │             │  → no oversight       │
│ Google sign-in    │             │ AI parse + score      │             │ Govern all candidates │
│ Track status live │             │  → manual triage      │             │ Global live pipeline  │
│  → black hole     │             │ Ranked pipeline board │             │  → no visibility      │
│ See interviews    │             │  → inconsistent screen│             │ Agent activity log    │
│  → slow comms     │             │ 1-click shortlist/    │             │  → no accountability  │
│ Manage profile    │             │   reject/invite       │             │ Global analytics      │
│ Auto interview    │             │ Calendar scheduling   │             │                       │
│  booking          │             │  → scheduling ping-pong             │                       │
│  → painful sched. │             │ Auto email + replies  │             │                       │
│                   │             │  → communication drag │             │                       │
└─────────┬─────────┘             └───────────┬───────────┘             └───────────┬───────────┘
          │                                   │                                     │
          └───────────────────────────────────┼─────────────────────────────────────┘
                                              ▼
                    ┌───────────────────────────────────────────────┐
                    │   SHARED FOUNDATION (all stakeholders)         │
                    │  • Six-agent AI engine (OpenAI Agents SDK)     │
                    │  • Real-time WebSocket pipeline (/ats/ws)      │
                    │  • Neon PostgreSQL single source of truth     │
                    │  • Custom JWT auth + Google OAuth 2.0         │
                    │  • Full audit trail (agent_runs)              │
                    └───────────────────────────────────────────────┘
```

### Capability → Problem → Beneficiary

| Capability | Problem it solves | Who benefits |
|---|---|---|
| Public career site + job discovery | Opportunities hard to find | Candidate |
| One-click apply + Google sign-in | Clunky, repetitive forms | Candidate |
| Candidate portal + live status tracking | Application black hole | Candidate |
| Automatic interview booking & reminders | Painful scheduling, slow comms | Candidate + Recruiter |
| Multi-channel intake (site/email/LinkedIn/forms) | Resume overload from scattered sources | Recruiter |
| Resume Parser Agent | Manual data entry from attachments | Recruiter |
| Scoring Agent (0–100 + explanation) | Inconsistent, biased, slow screening | Recruiter |
| Real-time ranked pipeline board | No single source of truth | Recruiter |
| Job posting & management | Fragmented job management | Recruiter |
| One-click shortlist / reject / invite | Manual triage & decisions | Recruiter |
| Scheduling + Email + Reply Intent agents | Scheduling ping-pong & communication drag | Recruiter + Candidate |
| Recruiter provisioning & control | Ad-hoc user management | Admin |
| Global pipeline + job/candidate governance | No organizational oversight | Admin |
| Agent activity log | No accountability for automation | Admin |
| Global analytics & reporting | No hiring insight | Admin |

---

## What RecruitFlow AI Does

### For Candidates
- **One-click applications** — Apply to any role with your resume (PDF/DOCX), LinkedIn profile, or email. No lengthy forms.
- **Real-time status tracking** — Watch your application move through the pipeline from *Received* → *Scored* → *Shortlisted* → *Interview Scheduled* in your personal dashboard.
- **Automatic interview booking** — When you're selected, the system checks the recruiter's calendar, proposes a time, and sends you a calendar invite — no back-and-forth.
- **Email reply understanding** — Reply to an interview invite with "I can't make it, can we reschedule?" and the system reads your intent, cancels the old slot, books a new one, and confirms automatically.

### For Recruiters
- **Multi-channel intake** — Applications land from your career site, a dedicated email inbox, LinkedIn forwarding, and Google Forms — all into one pipeline.
- **AI scoring with explanations** — Every candidate gets a 0–100 score against the job description, a classification band (Highly Recommended / Recommended / Consider / Not Recommended), and a paragraph explaining *why*.
- **Live pipeline board** — A real-time Kanban or table view of every application, filterable by job, score, status, and source channel. Updates the instant an agent finishes its work.
- **One-click actions** — Shortlist, reject in bulk, or send an interview invite. The system drafts the email, books the slot, logs everything, and keeps you in the loop when the candidate replies.
- **Google Calendar integration** — Connect your calendar once; the scheduling agent will only propose times when you're actually free, respecting your working hours.

### For Admins
- **Recruiter management** — Create recruiter accounts with auto-generated credentials, disable/re-enable them, and see every job and application across the organization.
- **Global pipeline** — One unified view of every candidate, every job, every interview — unfiltered.
- **Agent activity log** — A searchable audit trail of every AI agent run: which agent, which application, what it did, whether it succeeded, and what it handed off to next.
- **Analytics** — Total applications, shortlisted count, interview pipeline, average score, active job openings, recruitment progress %, and time-to-hire.

---

## System Architecture

RecruitFlow AI is built as **five layers**. The diagram below is the complete, accurate map of the platform — every frontend, every backend layer, every integration, and the data store they all share.

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                         PRESENTATION LAYER (Vercel)                            ║
║   Next.js 16 · React 19 · TypeScript · Tailwind v4 · portal-scoped cookies    ║
║                                                                               ║
║  ┌────────────────────────┐  ┌────────────────────┐  ┌────────────────────┐  ║
║  │ recruitflow-website    │  │ recruitflow-       │  │ recruitflow-admin  │  ║
║  │ ─────────────────────  │  │   recruiter        │  │ ────────────────── │  ║
║  │ PUBLIC SITE            │  │ ─────────────────  │  │ Global dashboard   │  ║
║  │  home/features/about   │  │ Dashboard + live   │  │ Recruiter mgmt     │  ║
║  │  /faq/jobs/apply       │  │   pipeline board   │  │ Job governance     │  ║
║  │ CANDIDATE PORTAL       │  │ Kanban / Table     │  │ Candidate govern.  │  ║
║  │  dashboard/apps/       │  │ Candidate detail   │  │ Global pipeline    │  ║
║  │  interviews/profile    │  │ Jobs / Interviews  │  │ Agent activity log │  ║
║  │  /jobs/notifications   │  │ Settings + Calendar│  │ Global analytics   │  ║
║  │ cookie: candidate_     │  │ cookie: recruiter_ │  │ cookie: admin_     │  ║
║  └───────────┬────────────┘  └─────────┬──────────┘  └─────────┬──────────┘  ║
╚══════════════╪═════════════════════════╪═══════════════════════╪═════════════╝
               │      REST (credentials: include, X-Portal header)│
               │      +  WebSocket  /ats/ws  (live pipeline)      │
               └─────────────────────────┼───────────────────────┘
                                         ▼
╔═══════════════════════════════════════════════════════════════════════════════╗
║                    API LAYER  —  FastAPI (Render)                              ║
║  /auth  /jobs  /applications  /interviews  /recruiter  /admin                 ║
║  /ats (REST + WebSocket)  /analytics  /files       + role-based guards        ║
╚═══════════════════════════════════════╪═══════════════════════════════════════╝
                                         ▼
╔═══════════════════════════════════════════════════════════════════════════════╗
║                          AGENTIC AI LAYER (OpenAI Agents SDK)                  ║
║                     LLM: openai/gpt-4o-mini via OpenRouter proxy              ║
║                                                                               ║
║                        ┌──────────────────────────┐                          ║
║                        │    ORCHESTRATOR AGENT     │  entry point / router    ║
║                        └────────────┬─────────────┘   via handoff()          ║
║         ┌───────────────┬───────────┼───────────┬────────────────┐           ║
║         ▼               ▼           ▼           ▼                ▼            ║
║  ┌────────────┐ ┌────────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────┐  ║
║  │  Resume    │ │  Scoring   │ │ Schedul- │ │  Email   │ │  Reply Intent  │  ║
║  │  Parser    │ │            │ │  ing     │ │          │ │                │  ║
║  │ parse→JSON │ │ score 0-100│ │ calendar │ │ 6 templ. │ │ classify reply │  ║
║  └────────────┘ └────────────┘ └──────────┘ └──────────┘ └────────────────┘  ║
║        every run logged to agent_runs (full audit trail)                      ║
╚═══════════════════════════════════════╪═══════════════════════════════════════╝
                                         ▼
╔═══════════════════════════════════════════════════════════════════════════════╗
║                              SERVICES LAYER                                    ║
║  calendar_service · email_service · storage_service · intake_service          ║
║  resume_extraction · google_oauth · events (WebSocket broadcast)              ║
╚══════╤═══════════════════════════════════════════════════════════╤════════════╝
       │                                                           │
       ▼                                                           ▼
╔══════════════════════════════════════════╗   ╔═══════════════════════════════╗
║       AUTOMATION & INTEGRATION           ║   ║          DATA LAYER           ║
║  Celery + Redis (job queue)              ║   ║   Neon PostgreSQL (serverless)║
║  imap_worker   → resume emails           ║   ║   SQLModel/SQLAlchemy + Alembic║
║  forms_worker  → Google Forms responses  ║   ║   ─────────────────────────── ║
║  reminder_worker → 24h interview reminder║   ║   users · recruiter_profiles  ║
║  ── external APIs ──                     ║   ║   jobs · candidates           ║
║  Google Calendar · Gmail/SMTP · IMAP     ║   ║   applications · interviews   ║
║  Cloudflare R2 / S3 (resumes, avatars)   ║   ║   email_logs · agent_runs     ║
╚══════════════════════════════════════════╝   ╚═══════════════════════════════╝
                       ▲
                       │
╔══════════════════════╧════════════════════════════════════════════════════════╗
║                              INTAKE LAYER                                      ║
║  Website upload (POST /applications)  ·  Email (IMAP)  ·  LinkedIn forwarding  ║
║  ·  Google Forms  →  single ingest_resume(file, metadata) entry point         ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### How It Works (End-to-End)

1. **Candidate applies** via website, email, LinkedIn, or Google Form → resume lands in **Intake Layer**
2. Intake stores the file (S3/R2), creates `candidate` + `application` records (`status = received`), and the Email Agent fires an **Application Confirmation**
3. **Orchestrator Agent** wakes up, hands off to **Resume Parser Agent**
4. Resume Parser extracts structured data (name, email, skills, experience, education) → saves to `candidates.parsed_data` (`status = parsed`)
5. Orchestrator hands off to **Scoring Agent**
6. Scoring Agent pulls the job description, evaluates the candidate, returns `{score, classification, explanation}` → saves to `applications` (`status = scored`)
7. **Recruiter Dashboard** and the **Candidate Portal** both update in real time via WebSocket
8. Recruiter reviews pipeline, clicks **Send Interview Invitation**
9. **Scheduling Agent** checks recruiter's Google Calendar free/busy → finds next available slot → creates calendar event
10. **Email Agent** drafts + sends Interview Invitation email with calendar attachment
11. Background job schedules **Reminder Email** 24 hours before interview
12. Candidate replies → **Reply Intent Agent** classifies intent (confirm / reschedule / cancel)
13. **Scheduling Agent** + **Email Agent** act accordingly (cancel old slot, book new one, confirm)
14. ATS tables update at every step — dashboards read directly from live data

---

## The Six AI Agents

RecruitFlow AI uses the **OpenAI Agents SDK** to build a team of specialist agents. Each agent has **tools** (Python functions it can call), **instructions** (its role and decision-making rules), and the ability to **hand off** to other agents via the Orchestrator.

| Agent | Responsibility | Key Tools |
|---|---|---|
| **Orchestrator Agent** | Entry point; routes every task to the right specialist via `handoff()` | `handoff()` to all five agents |
| **Resume Parser Agent** | Extracts structured data from raw resume text (PDF/DOCX → JSON) | `save_parsed_candidate()`, `flag_low_confidence_extraction()` |
| **Scoring Agent** | Scores candidate vs job description (0–100, classification, explanation) | `get_job_description()`, `save_score()` |
| **Scheduling Agent** | Finds free slots, books/updates/cancels Google Calendar events | `get_free_busy()`, `book_interview()`, `reschedule_interview()`, `cancel_interview()` |
| **Email Agent** | Drafts and sends every transactional email using branded HTML templates | `render_email_template()`, `send_email()`, `log_email()` |
| **Reply Intent Agent** | Reads inbound candidate email, classifies intent, hands off to Scheduling + Email | `classify_reply_intent()`, `write_explanation_note()`, handoff |

### Score Classification Bands
- **90–100** — Highly Recommended
- **75–89** — Recommended
- **60–74** — Consider
- **<60** — Not Recommended

All agent runs are logged to the `agent_runs` table with input/output summaries, status (success/failed), and which agent was handed off to next. The Admin Dashboard exposes this log as a searchable audit trail.

---

## End-to-End Workflow

RecruitFlow AI runs several interlocking workflows. Below are the four that matter most: the **recruiter/AI screening pipeline**, the **candidate journey**, the **job lifecycle**, and the **data model** that ties them together.

### 1. Screening & Interview Pipeline (Application → Confirmed Interview)

The following sequence shows a single application flowing through the entire system, from the candidate clicking "Apply" to a confirmed interview:

```
CANDIDATE          INTAKE           AGENTS                    RECRUITER         CANDIDATE
   │                  │                │                         │                 │
   │─ Apply (resume)─▶│                │                         │                 │
   │                  │─ store file    │                         │                 │
   │                  │  create records│                         │                 │
   │                  │  status=received                         │                 │
   │                  │                │                         │                 │
   │◀─ Confirmation ──┼────────────────┤ (Email Agent)           │                 │
   │   email          │                │                         │                 │
   │                  │─ trigger ──────▶ Orchestrator            │                 │
   │                  │                │  └▶ Resume Parser        │                 │
   │                  │                │     status=parsed        │                 │
   │                  │                │  └▶ Scoring Agent         │                 │
   │                  │                │     status=scored ───────▶ pipeline board  │
   │                  │                │     (live WebSocket)     │  updates        │
   │                  │                │                         │                 │
   │                  │                │                         │─ Send Invite ──┐│
   │                  │                │  Scheduling Agent ◀──────┼─────────────────┘
   │                  │                │  └▶ check free/busy      │                 │
   │                  │                │  └▶ book calendar event  │                 │
   │                  │                │  Email Agent             │                 │
   │◀─ Interview invite (+ .ics) ──────┼─────────────────────────┼─────────────────│
   │                  │                │                         │                 │
   │─ "Can we move it?"────────────────▶ Reply Intent Agent      │                 │
   │                  │                │  classify: reschedule    │                 │
   │                  │                │  └▶ Scheduling: cancel+rebook               │
   │◀─ New time confirmed ─────────────┼─────────────────────────┼─────────────────│
   │                  │                │                         │  board updates  │
```

Every arrow that touches an agent writes a row to `agent_runs`. Every email writes a row to `email_logs`. Every status change is broadcast to both the recruiter's dashboard and the candidate's portal over the `/ats/ws` WebSocket. Nothing happens silently.

### 2. The Candidate Journey (Discover → Hired)

The candidate's own experience of the platform — from finding a role to getting hired — with full visibility at every step:

```
  DISCOVER            APPLY               TRACK                INTERVIEW            OUTCOME
 ┌─────────┐       ┌──────────┐       ┌────────────┐       ┌─────────────┐      ┌──────────┐
 │ Browse  │──────▶│ 1-click  │──────▶│ Portal:    │──────▶│ Auto-booked │─────▶│ Offer /  │
 │ career  │       │ apply +  │       │ live status│       │ interview + │      │ Rejection│
 │ site or │       │ resume   │       │ pipeline   │       │ reminders   │      │ (branded │
 │ portal  │       │ upload   │       │ per app    │       │             │      │  email)  │
 └─────────┘       └──────────┘       └────────────┘       └──────┬──────┘      └──────────┘
      │                 │                    ▲                    │
      │            ┌────┴─────┐              │              ┌─────┴──────┐
      │            │ Google   │              │              │ Reply to   │
      └───────────▶│ sign-in  │              └──────────────│ invite →   │
                   │ (OAuth)  │        real-time updates     │ confirm /  │
                   └──────────┘        via WebSocket         │ reschedule │
                                                             │ / decline  │
                                                             └────────────┘
   Confirmation      Status moves        Received → Parsed     Reply Intent Agent
   email sent        appear instantly    → Scored →            reads intent &
   on submit         (no black hole)     Shortlisted → …       re-books automatically
```

### 3. The Job Lifecycle (Recruiter/Admin)

How a role moves through the platform, from creation to the applicants it attracts:

```
  RECRUITER                        PLATFORM                         ADMIN
 ┌──────────┐                                                    ┌──────────┐
 │ Create   │   draft ──▶ open ──▶ closed                        │ Oversee  │
 │ job      │──────────────┬───────────────                      │ ALL jobs │
 │ (title,  │              │                                     │ across   │
 │ skills,  │              ▼                                     │ every    │
 │ desc)    │      Published to public career site               │ recruiter│
 └──────────┘              │                                     │ (view/   │
      │                    ▼                                     │  edit/   │
      │            Candidates discover & apply                   │  delete) │
      │                    │                                     └────┬─────┘
      │                    ▼                                          │
      │            Applicants scored against THIS job's               │
      │            description & required_skills by Scoring Agent     │
      │                    │                                          │
      ▼                    ▼                                          ▼
 Manage applicants   Ranked pipeline board            Global governance & analytics
 (shortlist/reject/  filtered by job                  (unfiltered across org)
  invite)
```

### 4. Data Model & Relationships

The ten Neon PostgreSQL tables and how they relate — the single source of truth every dashboard reads from:

```
                         ┌──────────────┐
                         │    users     │  role: admin / recruiter / candidate
                         │  (UUID PK)   │  email · password_hash · google_id
                         └──────┬───────┘  full_name · picture_url · gender
                    ┌───────────┼───────────────┐
                    ▼           ▼               ▼
        ┌───────────────────┐ ┌──────────────┐  │ (candidate may link)
        │ recruiter_profiles│ │   candidates │◀─┘
        │ working_hours     │ │ parsed_data  │
        │ google_refresh_tok│ │ source_channel│
        │ (encrypted)       │ │ resume_file_url│
        └─────────┬─────────┘ └──────┬───────┘
                  │ owns              │
                  ▼                   │ applies
             ┌─────────┐              │
             │  jobs   │◀─────────────┤
             │ title   │   ┌──────────▼───────────┐
             │ desc    │   │     applications      │  the ATS core
             │ skills  │──▶│ score · classification│
             │ status  │   │ score_explanation     │
             └─────────┘   │ status (lifecycle)    │
                           └──────┬─────────┬──────┘
                                  │         │
                        ┌─────────▼──┐   ┌──▼─────────┐
                        │ interviews │   │ email_logs │
                        │ google_    │   │ type       │
                        │  event_id  │   │ sent_at    │
                        │ status     │   │ status     │
                        └────────────┘   └────────────┘

     ┌──────────────┐   Cross-cutting audit — references applications,
     │  agent_runs  │   written by EVERY agent on EVERY run:
     │ agent_name   │   agent_name · input/output_summary ·
     │ status       │   handed_off_to · status (success/failed)
     └──────────────┘
```

---

## Technology Stack

| Area | Technology |
|---|---|
| **Frontend** | Next.js 16 (App Router) + TypeScript 5 + React 19 |
| **Styling** | Tailwind CSS v4 (`@theme inline` CSS-first config) |
| **State / Real-time** | WebSockets (FastAPI) + React hooks |
| **Backend API** | Python 3.11 + FastAPI (REST + WebSocket) |
| **Agentic AI** | OpenAI Agents SDK — six agents |
| **LLM Access** | OpenRouter proxy → `openai/gpt-4o-mini` |
| **Background Jobs** | Celery + Redis (APScheduler for reminders) |
| **Database** | Neon PostgreSQL — SQLModel/SQLAlchemy ORM, Alembic migrations |
| **Resume Parsing** | PyMuPDF / pdfplumber (PDF) + python-docx (DOCX) |
| **Auth** | Custom JWT (access + refresh) + bcrypt/argon2 + Google OAuth 2.0 |
| **Calendar** | Google Calendar API (OAuth 2.0) |
| **Email** | Gmail API / SMTP (Resend/SendGrid fallback) for sending; IMAP for reading |
| **File Storage** | Cloudflare R2 / S3-compatible object storage (boto3) |
| **Frontend Hosting** | Vercel (three projects) |
| **Backend Hosting** | Render — Docker web service |
| **Version Control** | Git & GitHub |

---

## Repository Layout

RecruitFlow AI is a **multi-repository product**. Each surface is deployed independently, and each frontend keeps its own auth session isolated via a portal-scoped cookie (`candidate_`, `recruiter_`, `admin_` prefixes) and an `X-Portal` request header.

```
RecruitFlow AI/
├── recruitflow-backend/      → Python + FastAPI API, six AI agents, workers
├── recruitflow-website/      → Public career site + Candidate Portal (Next.js)
├── recruitflow-recruiter/    → Recruiter Dashboard (Next.js)
└── recruitflow-admin/        → Admin Dashboard (Next.js)
```

### `recruitflow-backend/`
```
app/
  api/            → FastAPI routers (auth, jobs, applications, interviews,
                     recruiter, admin, ats, analytics, files)
  agents/         → orchestrator, resume_parser, scoring, scheduling,
                     email, reply_intent + llm_config + runner
  services/       → calendar_service, email_service, storage_service
  workers/        → Celery/APScheduler jobs (reminders, IMAP polling)
  models/         → SQLModel table definitions
  core/           → deps (auth guards), config, security
  db/             → session + Alembic migrations
  main.py         → FastAPI app entrypoint
Dockerfile        → container image for Render deployment
requirements.txt
```

### `recruitflow-website/` (Candidate)
```
app/
  (public)/       → home, jobs list, job detail, apply, about
  (auth)/         → login, signup, Google OAuth callback
  portal/         → candidate dashboard, applications, interviews, profile, jobs
components/       → site + dashboard + ui component libraries
lib/              → api client, auth helpers
proxy.ts          → route guard for /portal/* (Next 16 middleware)
```

### `recruitflow-recruiter/`
```
app/
  recruiter/      → dashboard, pipeline, interviews, jobs, settings
components/       → pipeline kanban/table, analytics cards, candidate panel
lib/api.ts        → recruiter-scoped API client
proxy.ts          → route guard for /recruiter/*
```

### `recruitflow-admin/`
```
app/
  admin/          → dashboard, recruiters, jobs, candidates, pipeline, agent-log
components/       → admin tables, analytics, global pipeline
lib/api.ts        → admin-scoped API client
proxy.ts          → route guard for /admin/*
```

Full, file-by-file documentation lives in each repository's own README — see [Per-Repository Documentation](#per-repository-documentation).

---

## Data Model

Ten core tables in Neon PostgreSQL, managed with SQLModel and versioned with Alembic migrations:

| Table | Purpose |
|---|---|
| **users** | All accounts (admin/recruiter/candidate) — shared `role` column, `email`, `password_hash`, `google_id`, `full_name`, `picture_url`, `gender`, `is_active` |
| **recruiter_profiles** | Per-recruiter settings — `company_name`, working hours, `google_calendar_connected`, encrypted `google_refresh_token` |
| **jobs** | Job postings — `title`, `description`, `required_skills` (JSONB), `status` (open/closed/draft), `recruiter_id` |
| **candidates** | Applicant records — contact details, `source_channel`, `resume_file_url`, `parsed_data` (JSONB) |
| **applications** | The heart of the ATS — links candidate ↔ job, `score`, `classification`, `score_explanation`, `status` |
| **interviews** | `google_event_id`, `scheduled_start`/`end`, `status`, `cancellation_reason`, `last_candidate_reply` |
| **email_logs** | Every email sent — `type`, `sent_at`, `status` (sent/failed/replied) |
| **agent_runs** | Full agent audit trail — `agent_name`, `input_summary`, `output_summary`, `handed_off_to`, `status` |

### Application Status Lifecycle
```
received → parsed → scored → shortlisted ─┬─▶ interview_scheduled → interview_completed → offer → hired
                                          └─▶ rejected
```

---

## Security

- **Passwords** hashed with bcrypt/argon2 — never stored or logged in plaintext
- **JWT access tokens** short-lived (15 min); **refresh tokens** (7 days) as httpOnly, Secure, SameSite cookies
- **Portal-scoped cookies** (`candidate_`/`recruiter_`/`admin_` prefixes) keep the three sessions isolated
- **Google OAuth tokens** (login + Calendar refresh tokens) encrypted at rest
- **Role checks** enforced server-side on every endpoint via FastAPI dependencies
- **File upload validation** — PDF/DOCX only, size-limited
- **Rate limiting** on auth endpoints
- **All secrets** in Vercel Environment Variables (frontend) and Render service environment variables (backend) — never committed
- **Full audit trail** — every agent action logged to `agent_runs`

---

## Per-Repository Documentation

Each repository ships its own deep-dive README. This root README is the map; those are the territory.

| Repository | README | Covers |
|---|---|---|
| **recruitflow-backend** | [`recruitflow-backend/README.md`](recruitflow-backend/README.md) | Every API router, all six agents, services, workers, data model, deployment |
| **recruitflow-website** | [`recruitflow-website/README.md`](recruitflow-website/README.md) | Public career site + Candidate Portal, every page & component |
| **recruitflow-recruiter** | [`recruitflow-recruiter/README.md`](recruitflow-recruiter/README.md) | Recruiter Dashboard A–Z: pipeline, scoring, interviews, calendar |
| **recruitflow-admin** | [`recruitflow-admin/README.md`](recruitflow-admin/README.md) | Admin Dashboard: recruiter/job/candidate management, agent log, analytics |

---

## Author & Credits

**RecruitFlow AI™** is a complete product designed and engineered by:

**Sahir Ahmed Sheikh**
*AI Solutions Expert — BranDive Media Solutions*

RecruitFlow AI is a complete, general-purpose hiring platform built to serve candidates, recruiters, and organizations of any kind.

> RecruitFlow AI is a proprietary product. All rights reserved.

---

<div align="center">

**RecruitFlow AI™** — Built with FastAPI, Next.js 16, the OpenAI Agents SDK, and Neon PostgreSQL.

*© 2026 Sahir Ahmed Sheikh — BranDive Media Solutions. All rights reserved.*

</div>
