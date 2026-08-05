"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";

type NavItem = { label: string; href: string };

const NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "Features", href: "/features" },
  { label: "About Us", href: "/about" },
  { label: "FAQ", href: "/faq" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "#") return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Animated nav link: text turns brand-blue on hover, and an underline grows
 * left→right on hover (and reverses on leave). When the link matches the
 * active route, the underline stays permanently visible.
 */
function NavLink({
  item,
  pathname,
  onClick,
}: {
  item: NavItem;
  pathname: string;
  onClick?: () => void;
}) {
  const active = isActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`group relative inline-flex font-poppins text-sm font-medium transition-colors duration-200 hover:text-primary lg:text-base ${
        active ? "text-primary" : "text-zinc-800"
      }`}
    >
      {item.label}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute -bottom-1 left-0 h-0.5 w-full origin-left rounded-full bg-primary transition-transform duration-200 ease-out group-hover:scale-x-100 ${
          active ? "scale-x-100" : "scale-x-0"
        }`}
      />
    </Link>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 px-4 pt-4 lg:px-8 lg:pt-6">
      <div className="relative mx-auto flex h-[76px] max-w-[88rem] items-center justify-between rounded-full border border-zinc-200/60 bg-white px-6 shadow-[0_8px_30px_rgba(0,0,0,0.08)] lg:h-24 lg:px-12">
        {/* Left: logo */}
        <Link href="/" className="flex items-center" aria-label="RecruitFlow AI home">
          <Image
            src="/Logos/Recruitflow-logo-optimized.png"
            alt="RecruitFlow AI"
            width={532}
            height={132}
            preload
            loading="eager"
            sizes="(min-width: 1024px) 224px, 175px"
            className="h-11 w-auto lg:h-14"
          />
        </Link>

        {/* Center: navigation links, absolutely centered so they stay mid-header
            regardless of the differing left/right cluster widths */}
        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-9 lg:flex lg:gap-12">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.label} item={item} pathname={pathname} />
          ))}
        </nav>

        {/* Right cluster: Sign In + Sign Up (hidden below 450px — they move into the drawer) */}
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="hidden text-sm font-medium text-zinc-700 transition-colors hover:text-primary min-[450px]:inline-flex lg:text-base"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="hidden h-9 items-center rounded-lg bg-primary px-4 font-poppins text-sm font-medium text-white transition-colors hover:bg-primary/90 min-[450px]:inline-flex lg:h-10 lg:px-5 lg:text-base"
          >
            Sign Up
          </Link>

          {/* Mobile hamburger toggle */}
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-zinc-800 transition-colors hover:text-primary lg:hidden"
          >
            {menuOpen ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu drawer: nav links only (Sign In/Up stay in the pill above) */}
      {menuOpen && (
        <nav
          id="mobile-nav"
          className="mx-auto mt-2 max-w-6xl rounded-3xl border border-zinc-200/60 bg-white px-6 py-4 shadow-[0_8px_30px_rgba(0,0,0,0.08)] lg:hidden"
        >
          <ul className="flex flex-col gap-4">
            {NAV_ITEMS.map((item) => (
              <li key={item.label}>
                <NavLink
                  item={item}
                  pathname={pathname}
                  onClick={() => setMenuOpen(false)}
                />
              </li>
            ))}
          </ul>

          {/* Sign In / Sign Up move into the drawer only below 450px */}
          <div className="mt-4 flex flex-col gap-3 border-t border-zinc-200/60 pt-4 min-[450px]:hidden">
            <Link
              href="/login"
              onClick={() => setMenuOpen(false)}
              className="text-sm font-medium text-zinc-700 transition-colors hover:text-primary"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              onClick={() => setMenuOpen(false)}
              className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 font-poppins text-sm font-medium text-white transition-colors hover:bg-primary/90"
            >
              Sign Up
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
