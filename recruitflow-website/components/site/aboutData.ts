/**
 * About Us page content (PRD §5). Three sections, each rendered with the shared
 * <AboutSection> template. Edit copy and stat values here — the stats arrays are
 * the single source of truth, so updating any number is a one-line change.
 *
 * `image` points at a placeholder in /public/about — swap the file (keep the name)
 * to drop in a real photo later. `decor` selects which decorative illustration set
 * AboutSection draws around the image. `tint` alternates the section background.
 */
export interface AboutStat {
  value: string;
  label: string;
}

export interface AboutBlock {
  /** Optional sub-heading inside the body column (used by the Three Portals section). */
  label?: string;
  body: string;
}

export interface AboutSectionData {
  id: string;
  heading: string;
  tagline: string;
  /** One or more body blocks. Multiple blocks render as labelled mini-paragraphs. */
  blocks: AboutBlock[];
  stats: AboutStat[];
  image: string;
  imageAlt: string;
  /** Which decorative illustration variant to render around the image. */
  decor: 1 | 2 | 3;
  /** Faint blue-white background tint for visual rhythm between sections. */
  tint: boolean;
}

export const ABOUT_SECTIONS: AboutSectionData[] = [
  {
    id: "about-recruitflow",
    heading: "About RecruitFlow AI",
    tagline: "Smart hiring, made simple",
    blocks: [
      {
        body: "RecruitFlow AI is an intelligent hiring platform built to connect great candidates with great teams faster than traditional hiring ever could. It combines skilled human recruiters with AI-powered screening and matching, so every candidate is evaluated fairly and every recruiter can focus on the people who are the best fit — not endless resume piles. Whether hiring or job-hunting, RecruitFlow AI keeps the process fast, transparent, and built around real people.",
      },
    ],
    stats: [
      { value: "10,000+", label: "Candidates Matched" },
      { value: "500+", label: "Partner Recruiters" },
      { value: "48 hrs", label: "Average Response Time" },
    ],
    image: "/about/about-overview.webp",
    imageAlt: "RecruitFlow AI team collaborating",
    decor: 1,
    tint: false,
  },
  {
    id: "three-portals",
    heading: "One Platform, Three Portals",
    tagline: "Recruiters, candidates & admins — all in sync",
    blocks: [
      {
        label: "Recruiter Portal",
        body: "A dedicated dashboard to post jobs, review AI-screened and scored candidates, manage the hiring pipeline, and move candidates through Shortlisted or Rejected decisions — with interview scheduling and ATS updates handled automatically.",
      },
      {
        label: "Candidate Portal",
        body: "A simple space to build a profile once, apply to any open role in seconds, and track application status in real time — no repeated forms, no guessing where you stand.",
      },
      {
        label: "Admin Portal",
        body: "Platform-wide oversight — managing recruiter accounts, permissions, and overall hiring activity across the platform from one place.",
      },
    ],
    stats: [
      { value: "3", label: "Dedicated Portals" },
      { value: "24/7", label: "Platform Access" },
      { value: "100%", label: "Real-Time Sync" },
    ],
    image: "/about/about-portals.webp",
    imageAlt: "RecruitFlow AI platform portals",
    decor: 2,
    tint: true,
  },
  {
    id: "why-choose",
    heading: "Why Choose RecruitFlow AI",
    tagline: "Better hiring, without the guesswork",
    blocks: [
      {
        body: "AI resume parsing and screening cut down the time spent manually reviewing resumes, while automated interview scheduling and ATS syncing remove repetitive admin work. Real-time status updates keep both recruiters and candidates informed at every step, and AI-assisted, consistent evaluation helps reduce bias in the review process. Candidates get access to a wide range of roles from many recruiters — all through one simple platform.",
      },
    ],
    stats: [
      { value: "90%", label: "Faster Screening" },
      { value: "95%", label: "Match Accuracy" },
      { value: "4.8 / 5", label: "Recruiter Satisfaction" },
    ],
    image: "/about/about-why.webp",
    imageAlt: "RecruitFlow AI results and benefits",
    decor: 3,
    tint: false,
  },
];
