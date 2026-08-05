import Link from "next/link";
import Image from "next/image";

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Features", href: "#features" },
  { label: "About Us", href: "/about" },
  { label: "FAQ", href: "#" },
];

const CANDIDATE_LINKS = [
  { label: "Open Roles", href: "/jobs" },
  { label: "Candidate Sign In", href: "/login" },
  { label: "Candidate Sign Up", href: "/signup" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-zinc-200/80 bg-white">
      {/* Top accent line */}
      <div className="h-[3px] w-full bg-gradient-to-r from-primary via-primary/50 to-transparent" />

      <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8 xl:max-w-[1440px] 2xl:max-w-[1680px] 2xl:px-12">
        <div className="grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr] lg:gap-14">

          {/* Brand column */}
          <div className="max-w-md">
            <Link href="/" aria-label="RecruitFlow AI home">
              <Image
                src="/Logos/Recruitflow-logo-optimized.png"
                alt="RecruitFlow AI"
                width={532}
                height={132}
                sizes="260px"
                className="h-14 w-auto lg:h-16"
              />
            </Link>
            <p className="mt-6 text-base leading-relaxed text-zinc-500 lg:text-lg">
              RecruitFlow AI is an intelligent hiring platform that automates
              candidate screening, scoring, and interview scheduling — so
              recruiters can focus on the people, not the paperwork.
            </p>
          </div>

          {/* Navigation */}
          <div className="lg:justify-self-center">
            <h3 className="font-poppins text-sm font-semibold uppercase tracking-widest text-zinc-400">
              Navigation
            </h3>
            <ul className="mt-6 space-y-4">
              {NAV_LINKS.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="group inline-flex items-center text-base font-medium text-zinc-600 transition-colors duration-200 hover:text-primary"
                  >
                    <span className="mr-0 h-px w-0 bg-primary transition-all duration-200 group-hover:mr-2 group-hover:w-4" />
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Candidates */}
          <div className="lg:justify-self-center">
            <h3 className="font-poppins text-sm font-semibold uppercase tracking-widest text-zinc-400">
              Candidates
            </h3>
            <ul className="mt-6 space-y-4">
              {CANDIDATE_LINKS.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="group inline-flex items-center text-base font-medium text-zinc-600 transition-colors duration-200 hover:text-primary"
                  >
                    <span className="mr-0 h-px w-0 bg-primary transition-all duration-200 group-hover:mr-2 group-hover:w-4" />
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-zinc-200/80">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-6 py-6 sm:flex-row lg:px-8 xl:max-w-[1440px] 2xl:max-w-[1680px] 2xl:px-12">
          <p className="text-sm text-zinc-500">
            © {new Date().getFullYear()} RecruitFlow AI. All rights reserved.
          </p>
          <p className="text-sm text-zinc-400">
            Built by Sahir Ahmed Sheikh - BranDive Media Solutions
          </p>
        </div>
      </div>
    </footer>
  );
}
