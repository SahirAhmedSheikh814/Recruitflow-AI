"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { logout } from "@/lib/api";

/** Shared top nav for the recruiter and admin dashboards, with sign-out. */
export function DashboardNav({ links }: { links: { href: string; label: string }[] }) {
  const pathname = usePathname();

  async function handleLogout() {
    await logout();
    window.location.href = "/login";
  }

  return (
    <nav className="flex items-center gap-6 text-sm font-medium">
      {links.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={active ? "text-primary" : "text-zinc-600 hover:text-primary"}
          >
            {link.label}
          </Link>
        );
      })}
      <button onClick={handleLogout} className="text-zinc-400 hover:text-rejected">
        Sign out
      </button>
    </nav>
  );
}
