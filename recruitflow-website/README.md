# RecruitFlow AI — Career Website & Candidate Portal

**The candidate-facing front door: a polished public career site to discover and apply for roles, and a private portal to track applications, interviews, and profile — all in real time.**

---

## Live Deployment

| Resource | URL |
|---|---|
| **Career Website & Candidate Portal** (Vercel) | <https://recruitflow-ai-eta.vercel.app/> |
| **Backend API** (Render) | <https://recruitflow-ai-3u84.onrender.com> |
| **API Docs** (Swagger UI) | <https://recruitflow-ai-3u84.onrender.com/docs> |

---

## Table of Contents

1. [Overview](#overview)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure)
4. [The Public Career Website](#the-public-career-website)
5. [Authentication](#authentication)
6. [The Candidate Portal](#the-candidate-portal)
7. [Component Library](#component-library)
8. [API Client](#api-client)
9. [Design System](#design-system)
10. [Local Development](#local-development)
11. [Deployment](#deployment)

---

## Overview

The `recruitflow-website` repository serves **two distinct surfaces** from one Next.js 16 application:

1. **The Public Career Website** — the marketing and job-discovery site anyone can browse: home, features, about, FAQ, job listings, and job detail pages, plus the apply flow.
2. **The Candidate Portal** — the private, authenticated dashboard where a logged-in candidate tracks their applications through the pipeline, views scheduled interviews, browses and applies to more roles, and manages their profile and avatar.

The two are separated at the routing level: public pages live under `app/(public)/`, and the portal lives under `app/portal/`, guarded by `proxy.ts`.

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
| **Auth** | Custom JWT (`candidate_` cookie) + Google OAuth 2.0 |
| **Hosting** | Vercel |

> **Note:** This is Next.js 16 — middleware is `proxy.ts` (not `middleware.ts`).

---

## Project Structure

```
recruitflow-website/
├── app/
│   ├── layout.tsx                    → root layout, Inter + Poppins fonts, metadata
│   ├── globals.css                   → design tokens (colors, fonts)
│   ├── icon.png                      → RecruitFlow favicon (512×512)
│   ├── (public)/                     → PUBLIC CAREER SITE
│   │   ├── layout.tsx                → header + footer wrapper
│   │   ├── page.tsx                  → home page
│   │   ├── features/page.tsx         → features showcase
│   │   ├── about/page.tsx            → about / company
│   │   ├── faq/page.tsx              → frequently asked questions
│   │   ├── not-found.tsx             → 404 page
│   │   └── jobs/
│   │       ├── page.tsx              → job listings
│   │       └── [id]/
│   │           ├── page.tsx          → job detail
│   │           └── apply/page.tsx    → public apply form
│   ├── (auth)/                       → AUTH
│   │   ├── layout.tsx                → auth pages layout
│   │   ├── login/page.tsx            → login (+ Google button)
│   │   └── signup/page.tsx           → signup
│   └── portal/                       → CANDIDATE PORTAL (protected)
│       ├── layout.tsx                → dashboard shell wrapper
│       ├── page.tsx                  → candidate dashboard
│       ├── applications/page.tsx     → my applications (pipeline)
│       ├── interviews/page.tsx       → upcoming/past interviews
│       ├── profile/page.tsx          → profile picture + avatar + account
│       ├── settings/page.tsx         → account settings
│       ├── notifications/page.tsx    → notifications
│       └── jobs/
│           ├── page.tsx              → browse jobs in-portal
│           └── [id]/
│               ├── page.tsx          → job detail in-portal
│               └── apply/page.tsx    → in-portal apply
├── components/
│   ├── site/                         → public site components
│   ├── dashboard/                    → portal shell + nav
│   └── ui/                           → shared UI primitives
├── lib/
│   ├── api.ts                        → backend API client
│   ├── jobs.ts                       → job data helpers
│   └── jwt.ts                        → JWT decode helper (proxy guard)
├── proxy.ts                          → route guard for /portal/*
├── next.config.ts
└── package.json
```

---

## The Public Career Website

Everything under `app/(public)/` is open to the world and wrapped in a shared layout with `SiteHeader` and `SiteFooter`.

### Home (`app/(public)/page.tsx`)
The landing page. Composed of:
- **HomeHero** (`components/site/HomeHero.tsx`) — the opening statement with animated `HeroBackground` / `TopGlow`
- **FeaturesSection** — a scannable summary of what RecruitFlow AI does for candidates
- **CTACard** — the call to action driving visitors to the jobs list

### Features (`app/(public)/features/page.tsx`)
A deeper showcase built from `FeaturesHero`, `FeaturesOverview`, and `FeaturesGallery`, with content driven by `featuresData.ts` and `featuresColumns.ts`.

### About (`app/(public)/about/page.tsx`)
Company story via `AboutSection`, content from `aboutData.ts`.

### FAQ (`app/(public)/faq/page.tsx`)
Frequently asked questions rendered from `faqData.ts` over an animated `FAQBackground`.

### Job Listings (`app/(public)/jobs/page.tsx`)
The live list of open roles, rendered by `OpenRolesGrid`. Each card links to its detail page.

### Job Detail (`app/(public)/jobs/[id]/page.tsx`)
Full role description, required skills, and an **Apply** button. Uses `DetailCard` for the layout.

### Apply (`app/(public)/jobs/[id]/apply/page.tsx`)
The public application form (`ApplyForm`). A candidate uploads their resume (PDF/DOCX) and submits — works for guests and logged-in candidates alike. On submit, `submitApplication()` posts multipart form data to `POST /applications`, which kicks off the intake → agents pipeline. The success screen adapts its "Browse more roles" link depending on whether the applicant is inside the portal.

### 404 (`app/(public)/not-found.tsx`)
Branded not-found page.

---

## Authentication

### Login (`app/(auth)/login/page.tsx`)
Email/password login plus a **Continue with Google** button (`GoogleButton`). On success the backend sets the `candidate_` cookie pair.

### Signup (`app/(auth)/signup/page.tsx`)
Candidate self-registration.

### Google OAuth
The `GoogleButton` sends the candidate to `GET /auth/google`, which redirects to Google's consent screen. After consent, `GET /auth/google/callback` exchanges the code, creates or links the user (storing the Google profile `picture_url`), sets the candidate cookies, and redirects into `/portal`.

### Route Protection (`proxy.ts`)
Guards every `/portal/*` route: reads the `candidate_access_token` cookie, decodes the JWT (`lib/jwt.ts`), and redirects to `/login` if it's missing or expired, or bounces to the correct role home if the token belongs to a different role. The API client sends `X-Portal: candidate` so silent token refresh reads the right cookie.

---

## The Candidate Portal

Everything under `app/portal/` requires a valid candidate session and is wrapped in `DashboardShell` (sidebar nav + top bar with the candidate's `Avatar` and a logout button).

### Dashboard (`app/portal/page.tsx`)
The portal home. Fetches the current user, their applications, and their interviews in parallel, then shows:
- A **profile card** with the candidate's `Avatar` (uploaded photo, Google image, gender silhouette, or initials)
- **Application pipeline cards** — each application with its current status
- An **Upcoming Interviews** section pulling real scheduled interviews via `getMyInterviews()`

### My Applications (`app/portal/applications/page.tsx`)
The candidate's full application list with the status pipeline (Received → Parsed → Scored → Shortlisted → Interview Scheduled → …), fetched via `getMyApplications()`.

### Interviews (`app/portal/interviews/page.tsx`)
All the candidate's interviews, split into **Upcoming** and **Past** with `InterviewRow` and `StatusPill` components. Data from `getMyInterviews()` — matched to the candidate by user ID or email, enriched with job title, and excluding cancelled interviews.

### Profile (`app/portal/profile/page.tsx`)
Three cards:
- **Profile picture** — upload a photo (JPG/PNG/WEBP/GIF up to 5 MB) via `uploadProfilePicture()`; a hidden file input behind an "Upload/Change picture" button
- **Default avatar** — a male/female silhouette selector (`updateProfileGender()`) used when no photo is set; the choice drives the `Avatar` fallback
- **Account details** — name, email, and role badge

### Browse & Apply In-Portal (`app/portal/jobs/`)
Logged-in candidates can browse (`jobs/page.tsx`), view (`jobs/[id]/page.tsx`), and apply (`jobs/[id]/apply/page.tsx`) to more roles without leaving the portal. `ApplyForm` detects the portal context via `usePathname` and keeps navigation inside `/portal`.

### Settings & Notifications
- **Settings** (`app/portal/settings/page.tsx`) — account settings
- **Notifications** (`app/portal/notifications/page.tsx`) — candidate notifications

---

## Component Library

### Site Components (`components/site/`)
| Component | Purpose |
|---|---|
| **SiteHeader / SiteFooter** | Public site chrome |
| **HomeHero / HeroBackground / TopGlow** | Animated home hero |
| **FeaturesSection / FeaturesHero / FeaturesOverview / FeaturesGallery** | Features content |
| **AboutSection** | About page content |
| **FAQBackground** | FAQ animated backdrop |
| **OpenRolesGrid** | Job listings grid |
| **DetailCard** | Job detail layout |
| **ApplyForm** | Resume upload + submit (portal-aware) |
| **CTACard** | Call-to-action block |
| **Reveal** | Scroll-reveal animation wrapper |
| `aboutData.ts` / `faqData.ts` / `featuresData.ts` / `featuresColumns.ts` | Content data |

### Dashboard Components (`components/dashboard/`)
| Component | Purpose |
|---|---|
| **DashboardShell** | Portal layout — sidebar nav + top bar with `Avatar` and logout |
| **NavIcons** | Portal nav icon set |

### UI Primitives (`components/ui/`)
| Component | Purpose |
|---|---|
| **Avatar** | Fallback chain: uploaded/Google image → gender silhouette → initials, with `onError` handling |
| **GoogleButton** | "Continue with Google" OAuth button |
| **Button / Card / Badge / StatusBadge / Modal / TextField** | Shared primitives |

---

## API Client

`lib/api.ts` — the typed browser client. Sends `credentials: "include"` and `X-Portal: candidate`; on a 401 it silently refreshes once and replays. Candidate-relevant functions:
- **Auth:** `signup()`, `login()`, `logout()`, `getCurrentUser()`
- **Applications:** `submitApplication(form)`, `getMyApplications()`
- **Interviews:** `getMyInterviews()`, `getInterviewByApplication(id)`
- **Profile:** `uploadProfilePicture(file)`, `updateProfileGender(gender)`
- **Jobs:** public job fetch helpers (`lib/jobs.ts`)

---

## Design System

Tokens in `app/globals.css`:

| Token | Value |
|---|---|
| **Primary** | `#4A6CF7` |
| **Background** | `#FFFFFF` |
| **Shortlisted** | `#16A34A` |
| **Rejected** | `#DC2626` |
| **Pending** | `#F59E0B` |
| **Interview** | `#2563EB` |

**Fonts:** Poppins (headings, hero), Inter (body, tables), Times New Roman (formal documents).

---

## Local Development

```bash
npm install
npm run dev
```

`.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:7860
NEXT_PUBLIC_PORTAL=candidate
NEXT_PUBLIC_GOOGLE_CLIENT_ID=<your-google-client-id>
```

Runs at `http://localhost:3000`. Ensure the backend is up on port 7860.

---

## Deployment

Deployed to **Vercel** from the `recruitflow-website` repo — live at
<https://recruitflow-ai-eta.vercel.app/>.

1. Import the repo into Vercel
2. Set `NEXT_PUBLIC_API_URL` (`https://recruitflow-ai-3u84.onrender.com`), `NEXT_PUBLIC_PORTAL=candidate`, and `NEXT_PUBLIC_GOOGLE_CLIENT_ID` in Environment Variables
3. Deploy — Vercel builds the Next.js 16 app and serves both the public site and the candidate portal

> **Backend cold starts:** the backend runs on Render's free plan, which sleeps
> after ~15 min idle and takes ~40–60s to wake. The API client (`lib/api.ts`)
> retries patiently through that window and shows a **"Waking up the server…"**
> banner (`components/ui/BackendWakeBanner.tsx`) instead of throwing a 504 /
> Network Error — so applying, logging in, or browsing jobs just waits briefly
> rather than failing during warm-up.

---

<div align="center">

**RecruitFlow AI™ Career Website & Candidate Portal** — Next.js 16 · React 19 · Google OAuth

*© 2026 Sahir Ahmed Sheikh — BranDive Media Solutions. All rights reserved.*

</div>