# RecruitFlow AI — Admin Dashboard

**Global oversight of the entire recruitment platform: manage recruiters, govern every job and candidate, watch the unified pipeline, and audit every AI agent action.**

---

## Live Deployment

| Resource | URL |
|---|---|
| **Admin Dashboard** (Vercel) | <https://recruitflow-ai-admin-dashboard.vercel.app/> |
| **Backend API** (Render) | <https://recruitflow-ai-3u84.onrender.com> |
| **API Docs** (Swagger UI) | <https://recruitflow-ai-3u84.onrender.com/docs> |

---

## Table of Contents

1. [Overview](#overview)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure)
4. [Authentication & Route Protection](#authentication--route-protection)
5. [Pages & Modules](#pages--modules)
6. [Component Library](#component-library)
7. [API Client](#api-client)
8. [Design System](#design-system)
9. [Local Development](#local-development)
10. [Deployment](#deployment)

---

## Overview

The **Admin Dashboard** is the top-level governance surface for RecruitFlow AI. Where a recruiter sees only their own jobs and candidates, the admin sees **everything** — every recruiter, every job across the whole organization, every candidate and application, the unfiltered real-time pipeline, and a searchable log of every AI agent that has ever run.

**What admins do here:**
- **Provision recruiters** — create accounts with auto-generated credentials, disable or re-enable them
- **Govern jobs** — view, edit, or delete any job posting across all recruiters
- **Manage candidates** — view, edit, or delete any candidate record, download any resume, review any score
- **Monitor the global pipeline** — the same real-time ATS board as recruiters, but unfiltered across the entire platform
- **Audit AI activity** — a searchable timeline of every agent run: which agent, which application, what it did, whether it succeeded, and what it handed off to

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
| **Auth** | JWT via httpOnly cookie (`admin_access_token`) |
| **Resume Storage** | Cloudflare R2 (via the backend) — résumés live in a private bucket and are streamed to the admin through the authenticated `/files/{key}` route |
| **Email** | Resend (via the backend) — automated email pipelines & notifications recorded in `email_logs` |
| **Hosting** | Vercel |

> **Note:** This is Next.js 16 — middleware is defined in `proxy.ts` (not `middleware.ts`), and conventions differ from earlier versions.

---

## Project Structure

```
recruitflow-admin/
├── app/
│   ├── layout.tsx                → root layout, fonts, metadata
│   ├── page.tsx                  → root redirect → /admin
│   ├── globals.css               → design tokens (colors, fonts)
│   ├── icon.png                  → RecruitFlow favicon
│   ├── (auth)/
│   │   ├── layout.tsx            → auth pages layout
│   │   └── login/page.tsx        → admin login
│   └── admin/
│       ├── layout.tsx            → dashboard shell wrapper
│       ├── page.tsx              → global dashboard (analytics + pipeline)
│       ├── recruiters/page.tsx   → recruiter management
│       ├── jobs/page.tsx         → global job management
│       ├── candidates/page.tsx   → candidate management
│       └── agent-log/page.tsx    → AI agent activity log
├── components/
│   ├── dashboard/
│   │   ├── DashboardShell.tsx    → sidebar + top bar layout
│   │   ├── DashboardNav.tsx      → sidebar navigation
│   │   ├── NavIcons.tsx          → nav icon set
│   │   ├── AnalyticsCards.tsx    → global KPI summary cards
│   │   ├── PipelineKanban.tsx    → global kanban board
│   │   ├── PipelineTable.tsx     → global table board
│   │   ├── CandidateDetailModal.tsx → parsed data + score + resume
│   │   └── SlotPicker.tsx        → time slot picker
│   └── ui/
│       ├── Button.tsx
│       ├── Card.tsx
│       ├── Badge.tsx
│       ├── StatusBadge.tsx
│       ├── Modal.tsx
│       └── TextField.tsx
├── lib/
│   ├── api.ts                    → backend API client (admin-scoped)
│   ├── jwt.ts                    → JWT decode helper (for proxy guard)
│   └── useLivePipeline.ts        → WebSocket hook for live updates
├── proxy.ts                      → route guard for /admin/*
├── next.config.ts
└── package.json
```

---

## Authentication & Route Protection

Every `/admin/*` route is guarded by `proxy.ts` (Next.js 16 middleware):

1. Reads the `admin_access_token` cookie
2. Decodes the JWT (`lib/jwt.ts`), verifies expiry and that the role is `admin`
3. Missing/expired token → redirect to `/login`
4. Wrong role → bounce to that role's home
5. Valid admin → proceed

The `admin_` cookie prefix isolates the admin session from recruiter and candidate sessions in the same browser. The API client sends `X-Portal: admin` on every request, so the backend reads the correct cookie on silent token refresh. Role enforcement is defense-in-depth: the middleware gates the UI, and every backend admin endpoint independently requires `require_role(UserRole.admin)`.

---

## Pages & Modules

### `/admin` — Global Dashboard (`app/admin/page.tsx`)
The organization-wide overview:
- **Global analytics cards** (`AnalyticsCards`) — total applications, shortlisted, interview pipeline, hired, average score, active openings, recruitment progress, time-to-hire — fed by `getAdminAnalyticsSummary()`
- **Global pipeline board** — the unfiltered ATS across every recruiter and job, with Kanban/Table views and live WebSocket updates
- Clicking any candidate opens the **Candidate Detail Modal**

### `/admin/recruiters` — Recruiter Management (`app/admin/recruiters/page.tsx`)
Provision and govern recruiter accounts:
- **List** every recruiter (name, email, active status, created date) via `getRecruiters()`
- **Create** a recruiter (`createRecruiter()`) — the backend generates a temporary password, displayed once for the admin to hand over
- **Disable / re-enable** any recruiter (`setRecruiterActive()`) — a disabled recruiter can no longer log in, but their jobs and history remain intact

### `/admin/jobs` — Global Job Management (`app/admin/jobs/page.tsx`)
Every job posting across all recruiters (`getAllJobs()`). Admins can view, edit, update, or delete any job regardless of which recruiter owns it — useful for cleanup, compliance, and correcting mistakes.

### `/admin/candidates` — Candidate Management (`app/admin/candidates/page.tsx`)
Every candidate record on the platform (`getAllCandidates()`):
- View full contact details, source channel, and parsed resume data
- Download any resume
- **Edit** candidate details (`updateCandidate()`) — name, email, phone, location, LinkedIn, portfolio
- **Delete** a candidate (`deleteCandidate()`)

### `/admin/agent-log` — AI Agent Activity Log (`app/admin/agent-log/page.tsx`)
The audit heart of the platform. A searchable, chronological timeline drawn from the `agent_runs` table (`getAgentRuns(limit)`). Each entry shows:
- **Agent name** — which of the six agents ran
- **Application** — the application it acted on (if any)
- **Input / output summary** — what it received and what it produced
- **Handed off to** — which agent it delegated to next
- **Status** — success or failed
- **Timestamp**

This is how an admin proves *why* any candidate was scored, scheduled, emailed, or rejected — full traceability for every autonomous action.

### `/login` — Admin Login (`app/(auth)/login/page.tsx`)
Email/password login. On success the backend sets the `admin_` cookie pair and the admin lands on the global dashboard.

---

## Component Library

The admin dashboard shares the same component architecture as the recruiter dashboard, configured for global (unfiltered) scope.

### Dashboard Components (`components/dashboard/`)

| Component | Purpose |
|---|---|
| **DashboardShell** | Persistent sidebar + top bar layout wrapping every `/admin/*` page. |
| **DashboardNav** | Sidebar links (Dashboard, Recruiters, Jobs, Candidates, Agent Log) with active-state highlighting. |
| **NavIcons** | Lucide icon set for the nav. |
| **AnalyticsCards** | Global KPI cards fed by `getAdminAnalyticsSummary()`. |
| **PipelineKanban** | Global Kanban board across all recruiters. |
| **PipelineTable** | Global table board with sortable rows. |
| **CandidateDetailModal** | Full candidate panel — parsed data, resume download, AI score + explanation. |
| **SlotPicker** | Time-slot picker (shared component). |

### UI Primitives (`components/ui/`)

| Component | Purpose |
|---|---|
| **Button** | Branded button with variants. |
| **Card** | Rounded, bordered container. |
| **Badge** | Generic pill label. |
| **StatusBadge** | Status-colored badge (green/red/amber/blue). |
| **Modal** | Accessible dialog wrapper. |
| **TextField** | Labeled form input with error states. |

---

## API Client

`lib/api.ts` is the typed, admin-scoped browser client. Core behaviour matches the other portals — `credentials: "include"`, `X-Portal: admin`, silent 401 refresh-and-replay. Admin-specific functions:

- **Recruiters:** `getRecruiters()`, `createRecruiter(email, fullName, companyName?)`, `setRecruiterActive(id, isActive)`
- **Jobs:** `getAllJobs()`
- **Candidates:** `getAllCandidates()`, `updateCandidate(id, body)`, `deleteCandidate(id)`
- **Agent log:** `getAgentRuns(limit)`
- **Analytics:** `getAdminAnalyticsSummary()`
- **Pipeline:** `getPipeline(filters)`, `openPipelineSocket()`

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

**Fonts:** Poppins (headings), Inter (body & tables).

---

## Local Development

```bash
npm install
npm run dev
```

Set environment variables in `.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:7860
NEXT_PUBLIC_PORTAL=admin
```

The dashboard runs at `http://localhost:3000` (or the next free port). Ensure the backend is running on port 7860.

---

## Deployment

Deployed to **Vercel** as its own project from the `recruitflow-admin` repo — live at
<https://recruitflow-ai-admin-dashboard.vercel.app/>.

1. Import the repo into Vercel
2. Set `NEXT_PUBLIC_API_URL` (`https://recruitflow-ai-3u84.onrender.com`) and `NEXT_PUBLIC_PORTAL=admin` in Environment Variables
3. Deploy — Vercel builds the Next.js 16 app and serves it on the assigned domain

> **Backend cold starts:** the backend runs on Render's free plan, which sleeps
> after ~15 min idle and takes ~40–60s to wake. The API client (`lib/api.ts`)
> retries patiently through that window and shows a **"Waking up the server…"**
> banner (`components/ui/BackendWakeBanner.tsx`) instead of throwing a 504 /
> Network Error, so the dashboard never shows a false failure during warm-up.

---

<div align="center">

**RecruitFlow AI™ Admin Dashboard** — Next.js 16 · React 19 · Full Platform Governance

*© 2026 Sahir Ahmed Sheikh — BranDive Media Solutions. All rights reserved.*

</div>