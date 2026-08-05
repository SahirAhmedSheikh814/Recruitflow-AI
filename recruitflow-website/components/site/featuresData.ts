import { Feature } from "@/types/feature";

/**
 * RecruitFlow AI's 8 features (PRD §5). Recruiter-facing features first (the
 * platform's primary value + the AI hiring pipeline), then candidate-facing.
 * Content is the single source of truth here; featuresColumns.ts only maps
 * these into the 5-column layout and attaches an image per panel.
 */
const featuresData: Feature[] = [
  {
    id: 1,
    icon: "LayoutDashboard",
    color: "from-[#4A6CF7] to-[#3B5BF6]",
    title: "Recruiter Dashboard",
    points: [
      "Aggregates applicants from career site, LinkedIn & email",
      "Centralized view of every job posting and its pipeline",
      "Real-time updates as candidates move through hiring stages",
      "One place to manage the entire hiring workflow",
    ],
  },
  {
    id: 2,
    icon: "ScanText",
    color: "from-[#4A6CF7] to-[#3B5BF6]",
    title: "AI Resume Parsing (LLM-Powered)",
    points: [
      "LLM-powered resume parsing on upload",
      "Extracts skills, experience & education automatically",
      "Converts unstructured resumes into structured candidate profiles",
      "Works across resumes sourced from any channel",
    ],
  },
  {
    id: 3,
    icon: "Target",
    color: "from-[#4A6CF7] to-[#3B5BF6]",
    title: "AI Job Matching & Candidate Scoring",
    points: [
      "Automatic job description ↔ candidate matching",
      "AI-generated candidate scoring & ranking",
      "Best-fit candidates surfaced first",
      "Cuts down manual resume review time",
    ],
  },
  {
    id: 4,
    icon: "ListChecks",
    color: "from-[#4A6CF7] to-[#3B5BF6]",
    title: "Human Review & Hiring Pipeline",
    points: [
      "Recruiter review step on top of AI scoring (human stays in control)",
      "One-click Shortlisted / Rejected decisions",
      "Clear visual hiring pipeline per role",
      "Full candidate history at every stage",
    ],
  },
  {
    id: 5,
    icon: "CalendarCheck",
    color: "from-[#4A6CF7] to-[#3B5BF6]",
    title: "Automated Scheduling & ATS Sync",
    points: [
      "Auto interview booking via Google Calendar / Calendly for shortlisted candidates",
      "Automatic rejection email for candidates not moving forward",
      "Real-time sync to your ATS (Airtable / Notion)",
      "No manual follow-up required after a decision is made",
    ],
  },
  {
    id: 6,
    icon: "UserCircle",
    color: "from-[#4A6CF7] to-[#3B5BF6]",
    title: "Easy Profile & One-Click Apply",
    points: [
      "Quick profile creation",
      "One-click apply to any open role",
      "No repetitive forms per application",
    ],
  },
  {
    id: 7,
    icon: "Briefcase",
    color: "from-[#4A6CF7] to-[#3B5BF6]",
    title: "Access to Multiple Recruiters & Roles",
    points: [
      "Browse jobs from many different recruiters/companies",
      "Wide variety of roles in one place",
      "No need to search multiple job sites",
    ],
  },
  {
    id: 8,
    icon: "Bell",
    color: "from-[#4A6CF7] to-[#3B5BF6]",
    title: "Real-Time Status & Fastest Response",
    points: [
      "Real-time application status updates",
      "Fastest possible recruiter response times",
      "No communication gaps after applying",
    ],
  },
];

export default featuresData;
