# RecruitFlow AI — Recruiter Dashboard

**The recruiter's command center: a live pipeline, AI scoring, one-click hiring actions, and Google Calendar-powered interview scheduling.**

---

## Live Deployment

| Resource | URL |
|---|---|
| **Recruiter Dashboard** (Vercel) | <https://recruitflow-ai-recruiter-dashboard.vercel.app/> |
| **Backend API** (Render) | <https://recruitflow-ai-3u84.onrender.com> |
| **API Docs** (Swagger UI) | <https://recruitflow-ai-3u84.onrender.com/docs> |

---

## Table of Contents

1. [Overview](#overview)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure)
4. [Authentication & Route Protection](#authentication--route-protection)
5. [Pages & Features](#pages--features)
6. [Component Library](#component-library)
7. [Real-Time Pipeline](#real-time-pipeline)
8. [API Client](#api-client)
9. [Design System](#design-system)
10. [Local Development](#local-development)
11. [Deployment](#deployment)

---

## Overview

The **Recruiter Dashboard** is the Next.js 16 application recruiters use every day. It is the human-in-the-loop control surface for RecruitFlow AI: the AI agents do the reading, scoring, scheduling, and writing, but every consequential decision — shortlist, reject, invite to interview — is made here by a person.

**What recruiters do here:**
- Watch applications flow across a **live pipeline board** as AI agents parse and score them in real time
- Open a **candidate detail panel** to read parsed resume data, download the resume, and review the AI's score explanation
- **Shortlist**, **bulk-reject**, or **send interview invitations** with a single click
- **Create, edit, and close** job postings
- **Connect Google Calendar** so the Scheduling Agent can book interviews inside their working hours
- Review every **scheduled and past interview** across their jobs

---

## Technology Stack

| Component | Technology |
|---|---|
| **Framework** | Next.js 16 (App Router) |
| **Language** | TypeScript 5 |
| **UI Library** | React 19 |
| **Styling** | Tailwind CSS v4 (`@theme inline`) |
| **Animation** | Framer Motion |
| **Icons** | Lucide React |
| **Charts** | Recharts |
| **Real-time** | Native WebSocket (`/ats/ws`) |
| **Auth** | JWT via httpOnly cookie (`recruiter_access_token`) |
| **Resume Storage** | Cloudflare R2 (via the backend) — résumés live in a private bucket and are streamed to the recruiter through the authenticated `/files/{key}` route |
| **Email** | Resend (via the backend) — automated email pipelines & notifications for rejections, shortlisting and interview invitations |
| **Hosting** | Vercel |

> **Note:** This is Next.js 16 — APIs and conventions differ from earlier versions. Middleware is defined in `proxy.ts` (not `middleware.ts`).

---

## Project Structure

```
recruitflow-recruiter/
├── app/
│   ├── layout.tsx                → root layout, fonts, metadata
│   ├── page.tsx                  → root redirect → /recruiter
│   ├── globals.css               → design tokens (colors, fonts)
│   ├── icon.png                  → RecruitFlow favicon
│   ├── (auth)/
│   │   ├── layout.tsx            → auth pages layout
│   │   └── login/page.tsx        → recruiter login
│   └── recruiter/
│       ├── layout.tsx            → dashboard shell wrapper
│       ├── page.tsx              → main dashboard (pipeline + analytics)
│       ├── interviews/page.tsx   → interviews list (upcoming/past)
│       ├── jobs/page.tsx         → job management
│       └── settings/page.tsx     → profile + Google Calendar connect
├── components/
│   ├── dashboard/
│   │   ├── DashboardShell.tsx    → sidebar + top bar layout
│   │   ├── DashboardNav.tsx      → sidebar navigation
│   │   ├── NavIcons.tsx          → nav icon set
│   │   ├── AnalyticsCards.tsx    → KPI summary cards
│   │   ├── PipelineKanban.tsx    → kanban board view
│   │   ├── PipelineTable.tsx     → table board view
│   │   ├── CandidateDetailModal.tsx → parsed data + score + actions
│   │   └── SlotPicker.tsx        → interview time slot picker
│   └── ui/
│       ├── Button.tsx
│       ├── Card.tsx
│       ├── Badge.tsx
│       ├── StatusBadge.tsx
│       ├── Modal.tsx
│       └── TextField.tsx
├── lib/
│   ├── api.ts                    → backend API client
│   ├── jwt.ts                    → JWT decode helper (for proxy guard)
│   └── useLivePipeline.ts        → WebSocket hook for live updates
├── proxy.ts                      → route guard for /recruiter/*
├── next.config.ts
└── package.json
```

---

## Authentication & Route Protection

The dashboard is gated by `proxy.ts` — the Next.js 16 middleware that guards every `/recruiter/*` route.

**How it works:**
1. On each request to a protected route, `proxy.ts` reads the `recruiter_access_token` cookie
2. It decodes the JWT (`lib/jwt.ts`) and checks expiry and role (`AREA_ROLE = "recruiter"`)
3. If the token is missing or expired → redirect to `/login`
4. If the token belongs to the wrong role → bounce to that role's home
5. Valid recruiter → request proceeds

The cookie is portal-scoped (`recruiter_` prefix), so a recruiter session never collides with a candidate or admin session in the same browser. The API client sends `X-Portal: recruiter` on every request so the backend reads the correct cookie during silent token refresh.

---

## Pages & Features

### `/recruiter` — Main Dashboard (`app/recruiter/page.tsx`)
The landing page and daily driver. Combines:
- **Analytics cards** (`AnalyticsCards`) — total applications, shortlisted, interview pipeline, average score, active openings, recruitment progress
- **Pipeline board** with a toggle between **Kanban** (`PipelineKanban`) and **Table** (`PipelineTable`) views
- **Live updates** — a WebSocket subscription (`useLivePipeline`) pushes new applications and status changes onto the board the instant an agent finishes, with no refresh
- **Filters** — by job, score range, status, and source channel
- Clicking any candidate opens the **Candidate Detail Modal**

### `/recruiter/interviews` — Interviews (`app/recruiter/interviews/page.tsx`)
Every scheduled, confirmed, and completed interview across the recruiter's jobs (admins see all), fetched via `getRecruiterInterviews()` and split into two sections:
- **Upcoming** — future interviews, sorted soonest-first, with an "*n* upcoming" badge
- **Past** — completed or elapsed interviews, muted

Each row shows the **candidate** (name + email), the **role**, the **scheduled time** (locale-formatted), and a colored **status pill** (Proposed / Confirmed / Rescheduled / Completed / Cancelled). Cancelled interviews are excluded server-side.

### `/recruiter/jobs` — Job Management (`app/recruiter/jobs/page.tsx`)
Full CRUD for the recruiter's job postings:
- **Create** a job (title, description, required skills, status)
- **Edit** any field
- **Close/reopen** or **delete** a posting
- Jobs drive both the public career site and the Scoring Agent's evaluation criteria

### `/recruiter/settings` — Profile & Calendar (`app/recruiter/settings/page.tsx`)
- **Company name** and **working hours** (default 9:00–17:00) — these constrain when the Scheduling Agent may propose interview slots
- **Connect Google Calendar** button — launches the OAuth consent flow (`getCalendarConnectUrl()`); on return, the encrypted refresh token is stored on the recruiter profile and the button reflects "connected"

### `/login` — Recruiter Login (`app/(auth)/login/page.tsx`)
Email/password login. On success the backend sets the `recruiter_` cookie pair and the recruiter lands on the dashboard.

---

## Component Library

### Dashboard Components (`components/dashboard/`)

| Component | Purpose |
|---|---|
| **DashboardShell** | The persistent layout — sidebar navigation + top bar (recruiter name, logout). Wraps every `/recruiter/*` page. |
| **DashboardNav** | Sidebar links (Dashboard, Interviews, Jobs, Settings) with active-state highlighting. |
| **NavIcons** | The Lucide icon set used in the nav. |
| **AnalyticsCards** | The row of KPI cards at the top of the dashboard, fed by `getAnalyticsSummary()`. |
| **PipelineKanban** | The Kanban board — columns per pipeline stage (Received → Parsed → Scored → Shortlisted/Rejected → Interview Scheduled → Completed → Hired), draggable cards. |
| **PipelineTable** | The table view — sortable rows showing candidate, score, classification, source channel, and status. |
| **CandidateDetailModal** | The full candidate panel — parsed resume data, resume download link, AI score + explanation, and the human-in-the-loop action buttons (Shortlist, Reject, Send Interview). |
| **SlotPicker** | Time-slot picker used when sending an interview invitation with a preferred start time. |

### UI Primitives (`components/ui/`)

| Component | Purpose |
|---|---|
| **Button** | Branded button with variants (primary, secondary, ghost). |
| **Card** | Rounded, bordered container used across the dashboard. |
| **Badge** | Generic pill label. |
| **StatusBadge** | Status-colored badge (green shortlisted, red rejected, amber pending, blue interview). |
| **Modal** | Accessible dialog wrapper. |
| **TextField** | Labeled form input with error states. |

---

## Real-Time Pipeline

Live updates are the dashboard's signature feature. `lib/useLivePipeline.ts` is a React hook that:
1. Fetches the initial pipeline via `getPipeline(filters)`
2. Opens a WebSocket to `/ats/ws` via `openPipelineSocket()`
3. Listens for broadcast events (application created, parsed, scored, status changed)
4. Merges each event into local state, so the board reflects agent activity within milliseconds
5. Cleans up the socket on unmount

The moment the Scoring Agent writes a score on the backend, `events.py` broadcasts it, and the recruiter watches the candidate slide from *Parsed* to *Scored* — no refresh, no polling.

---

## API Client

`lib/api.ts` is the typed browser-side client for the backend. Highlights:

- **`apiFetch<T>()`** — the core wrapper. Sends `credentials: "include"` and `X-Portal: recruiter` on every call; on a 401 it silently hits `/auth/refresh` once and replays the request, so a recruiter never sees a blip when their 15-minute access token expires.
- **Pipeline:** `getPipeline(filters)`, `openPipelineSocket()`
- **Actions:** `shortlistApplication(id)`, `rejectBulk(ids)`, `sendInterviewInvitation(id, preferredStart?)`, `getQualified(cutoff, jobId?)`
- **Jobs:** `getMyJobs()`, `createJob()`, `updateJob()`, `deleteJob()`
- **Profile:** `getRecruiterProfile()`, `updateRecruiterProfile()`, `getCalendarConnectUrl()`
- **Interviews:** `getRecruiterInterviews()`, `getInterviewByApplication(id)`
- **Analytics:** `getAnalyticsSummary()`

---

## Design System

Design tokens live in `app/globals.css`:

| Token | Value | Use |
|---|---|---|
| **Primary** | `#4A6CF7` | Brand color, buttons, accents |
| **Background** | `#FFFFFF` | Page background |
| **Shortlisted** | `#16A34A` (green) | Shortlisted status |
| **Rejected** | `#DC2626` (red) | Rejected status |
| **Pending** | `#F59E0B` (amber) | Pending status |
| **Interview** | `#2563EB` (blue) | Interview status |

**Fonts:**
- **Poppins** — headings, section titles (`font-poppins`)
- **Inter** — body text, tables, dashboard components (`font-inter`)

---

## Local Development

```bash
npm install
npm run dev
```

Set environment variables in `.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:7860
NEXT_PUBLIC_PORTAL=recruiter
```

The dashboard runs at `http://localhost:3000` (or the next free port). Ensure the backend is running on port 7860.

---

## Deployment

Deployed to **Vercel** as its own project from the `recruitflow-recruiter` repo — live at
<https://recruitflow-ai-recruiter-dashboard.vercel.app/>.

1. Import the repo into Vercel
2. Set `NEXT_PUBLIC_API_URL` (`https://recruitflow-ai-3u84.onrender.com`) and `NEXT_PUBLIC_PORTAL=recruiter` in Environment Variables
3. Deploy — Vercel builds the Next.js 16 app and serves it on the assigned domain

> **Backend cold starts:** the backend runs on Render's free plan, which sleeps
> after ~15 min idle and takes ~40–60s to wake. The API client (`lib/api.ts`)
> retries patiently through that window and shows a **"Waking up the server…"**
> banner (`components/ui/BackendWakeBanner.tsx`) instead of throwing a 504 /
> Network Error, so the dashboard never shows a false failure during warm-up.

---

<div align="center">

**RecruitFlow AI™ Recruiter Dashboard** — Next.js 16 · React 19 · Real-Time WebSocket

*© 2026 Sahir Ahmed Sheikh — BranDive Media Solutions. All rights reserved.*

</div>