"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

import { getCurrentUser, logout, type CurrentUser } from "@/lib/api";

type NavLink = {
  href: string;
  label: string;
  icon: React.ReactNode;
  action?: "logout";
};

function HamburgerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

/**
 * Shared dashboard shell with a fixed sidebar (desktop) / hamburger drawer (mobile).
 * Used identically across Candidate, Recruiter, and Admin dashboards — only the
 * `links` prop differs per role.
 */
export function DashboardShell({
  title,
  links,
  children,
}: {
  title: string;
  links: NavLink[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [avatarOpen, setAvatarOpen] = useState(false);

  useEffect(() => {
    getCurrentUser().then(setUser).catch(() => setUser(null));
  }, []);

  async function handleLogout() {
    await logout();
    window.location.href = "/login";
  }

  function NavItem({ link, onClick }: { link: NavLink; onClick?: () => void }) {
    if (link.action === "logout") {
      return (
        <button
          type="button"
          onClick={() => {
            onClick?.();
            handleLogout();
          }}
          className="group flex items-center gap-3 rounded-xl px-4 py-3 font-medium text-zinc-600 transition-all hover:bg-rejected/5 hover:text-rejected"
        >
          <span className="text-zinc-400 group-hover:text-rejected">{link.icon}</span>
          <span className="text-sm">{link.label}</span>
        </button>
      );
    }
    const active = pathname === link.href || (link.href !== "/" && pathname.startsWith(`${link.href}/`));
    return (
      <Link
        href={link.href}
        onClick={onClick}
        className={`group flex items-center gap-3 rounded-xl px-4 py-3 font-medium transition-all ${
          active
            ? "bg-primary/10 text-primary"
            : "text-zinc-600 hover:bg-primary/5 hover:text-zinc-900"
        }`}
      >
        <span className={active ? "text-primary" : "text-zinc-400 group-hover:text-zinc-600"}>
          {link.icon}
        </span>
        <span className="text-sm">{link.label}</span>
      </Link>
    );
  }

  return (
    <div className="flex min-h-screen bg-zinc-50">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-zinc-200 lg:bg-white lg:px-4 lg:py-6">
        <Link href={links[0].href} className="mb-8 flex justify-center">
          <Image
            src="/Logos/Recruitflow-logo-optimized.png"
            alt="RecruitFlow AI"
            width={532}
            height={132}
            priority
            sizes="224px"
            className="h-12 w-auto"
          />
        </Link>
        <nav className="flex flex-1 flex-col gap-1">
          {links.map((link) => (
            <NavItem key={link.href} link={link} />
          ))}
        </nav>
      </aside>

      {/* Mobile drawer backdrop */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-zinc-900/50 lg:hidden"
          onClick={() => setDrawerOpen(false)}
          style={{ animation: "fadeIn 200ms ease-out" }}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-zinc-200 bg-white px-4 py-6 lg:hidden ${
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          transition: "transform 250ms ease-out",
        }}
      >
        <div className="mb-8 flex items-center justify-between">
          <Link href={links[0].href} onClick={() => setDrawerOpen(false)}>
            <Image
              src="/Logos/Recruitflow-logo-optimized.png"
              alt="RecruitFlow AI"
              width={532}
              height={132}
              priority
              sizes="175px"
              className="h-11 w-auto"
            />
          </Link>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100"
            aria-label="Close menu"
          >
            <CloseIcon />
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {links.map((link) => (
            <NavItem key={link.href} link={link} onClick={() => setDrawerOpen(false)} />
          ))}
        </nav>
      </aside>

      {/* Main content area */}
      <div className="flex flex-1 flex-col">
        {/* Top bar */}
        <header className="flex h-16 items-center justify-between border-b border-zinc-200 bg-white px-4 lg:px-8">
          {/* Mobile: hamburger + logo */}
          <div className="flex items-center gap-4 lg:hidden">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="rounded-lg p-2 text-zinc-600 hover:bg-zinc-100"
              aria-label="Open menu"
            >
              <HamburgerIcon />
            </button>
            <Link href={links[0].href}>
              <Image
                src="/Logos/Recruitflow-logo-optimized.png"
                alt="RecruitFlow AI"
                width={532}
                height={132}
                priority
                sizes="175px"
                className="h-11 w-auto"
              />
            </Link>
          </div>

          {/* Desktop: page title */}
          <h1 className="hidden font-poppins text-xl font-bold text-zinc-900 lg:block">
            {title.includes("Dashboard") ? (
              <>
                {title.slice(0, title.indexOf("Dashboard"))}
                <span className="text-primary">Dashboard</span>
              </>
            ) : (
              title
            )}
          </h1>

          {/* Right cluster: bell + avatar */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
              aria-label="Notifications"
            >
              <BellIcon />
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setAvatarOpen(!avatarOpen)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 font-medium text-primary hover:bg-primary/20"
                aria-label="User menu"
              >
                {user?.full_name?.[0]?.toUpperCase() ?? "U"}
              </button>
              {avatarOpen && (
                <div className="absolute right-0 top-12 z-50 w-56 rounded-xl border border-zinc-200 bg-white p-2 shadow-lg">
                  <div className="border-b border-zinc-100 px-3 py-2">
                    <p className="text-sm font-medium text-zinc-900">{user?.full_name ?? "User"}</p>
                    <p className="text-xs text-zinc-400">{user?.email ?? ""}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-600 hover:bg-zinc-50"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </div>
  );
}
