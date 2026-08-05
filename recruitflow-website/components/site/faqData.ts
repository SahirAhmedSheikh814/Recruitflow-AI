/**
 * FAQ page content (PRD §5). Five categories, four questions each. Edit copy
 * here — the page renders directly from this array. The first category is
 * active by default and its first question is expanded by default.
 */
export interface FAQItem {
  question: string;
  answer: string;
}

export interface FAQCategory {
  name: string;
  questions: FAQItem[];
}

export const FAQ_CATEGORIES: FAQCategory[] = [
  {
    name: "General Questions",
    questions: [
      {
        question: "What is RecruitFlow AI?",
        answer:
          "RecruitFlow AI is an intelligent hiring platform that combines skilled human recruiters with AI-powered screening and matching, so candidates are evaluated fairly and recruiters can focus on the best-fit people instead of endless resume piles.",
      },
      {
        question: "Who is RecruitFlow AI for?",
        answer:
          "RecruitFlow AI is built for both sides of hiring — recruiters who want to post roles and let AI handle screening, scoring, and scheduling, and candidates who want to apply once and track their applications in real time across many different companies.",
      },
      {
        question: "Is RecruitFlow AI free to use?",
        answer:
          "Browsing open roles and applying as a candidate is free. Recruiters get access to the full hiring toolkit through their account — reach out via Sign Up to get started.",
      },
      {
        question: "Do I need an account to browse open roles?",
        answer:
          "No — you can browse open roles without an account. You'll need one to apply and to track your application status.",
      },
    ],
  },
  {
    name: "For Candidates",
    questions: [
      {
        question: "How do I apply for a job on RecruitFlow AI?",
        answer:
          "Create your profile once, then apply to any open role in just a click — no repetitive forms for every application.",
      },
      {
        question: "How will I know the status of my application?",
        answer:
          "You'll get real-time status updates as your application moves through the hiring pipeline, so there are no communication gaps after you apply.",
      },
      {
        question: "Can I apply to jobs from different recruiters on one platform?",
        answer:
          "Yes — RecruitFlow AI hosts roles from many different recruiters and companies, all in one place, so you don't need to search multiple job sites.",
      },
      {
        question: "What happens after I'm shortlisted?",
        answer:
          "Shortlisted candidates are automatically offered an interview time through the platform's scheduling integration — no back-and-forth emails needed.",
      },
    ],
  },
  {
    name: "For Recruiters",
    questions: [
      {
        question: "What is the Recruiter Portal and what can I do there?",
        answer:
          "The Recruiter Portal is your dashboard for posting jobs, reviewing AI-screened and scored candidates, and managing your entire hiring pipeline in one place.",
      },
      {
        question: "How do I post a new job opening?",
        answer:
          "From the Recruiter Portal, you can create, edit, and publish a job listing in minutes — it appears immediately in the Open Roles listings.",
      },
      {
        question: "Can I invite my team to collaborate on hiring?",
        answer:
          "Yes — recruiters can invite team members with role-based access, so hiring decisions stay collaborative and secure.",
      },
      {
        question: "How does the dashboard help me manage candidates?",
        answer:
          "Every applicant is tracked through clear pipeline stages (Applied → Shortlisted → Interview → Hired), with full history visible at every step.",
      },
    ],
  },
  {
    name: "AI Screening & Hiring Process",
    questions: [
      {
        question: "How does RecruitFlow AI's resume parsing work?",
        answer:
          "Every resume is automatically parsed using AI (LLM-powered) into structured candidate data — skills, experience, and education — with no manual data entry needed.",
      },
      {
        question: "How are candidates scored and ranked?",
        answer:
          "Parsed candidate data is automatically matched against the job description and scored, so the strongest-fit candidates are surfaced first.",
      },
      {
        question: "Does a human still review candidates, or is it fully automated?",
        answer:
          "Recruiters always make the final call. AI scoring narrows the field, but a human recruiter reviews and decides who moves forward — the process stays fast and fair.",
      },
      {
        question: "How does interview scheduling work?",
        answer:
          "Once a candidate is shortlisted, interview booking happens automatically through calendar integration — and candidates who aren't moving forward receive a timely, automatic update.",
      },
    ],
  },
  {
    name: "Account & Support",
    questions: [
      {
        question: "How do I sign up for RecruitFlow AI?",
        answer:
          'Click "Sign Up" in the top navigation and follow the steps to create your account as a candidate or recruiter.',
      },
      {
        question: "I forgot my password — what do I do?",
        answer:
          'Use the "Forgot password" option on the Sign In screen to reset it securely.',
      },
      {
        question: "How can I contact support?",
        answer:
          "Reach out through the contact details on the site footer, and the team will get back to you.",
      },
      {
        question: "Is my data secure on RecruitFlow AI?",
        answer:
          "Yes — candidate and recruiter data is handled securely, with role-based access controls protecting who can see what across the platform.",
      },
    ],
  },
];
