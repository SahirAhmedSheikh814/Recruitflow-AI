"use client";

import Image from "next/image";

/**
 * Header bar of the Riva chat panel: a brand-gradient banner with Riva's avatar,
 * name, a live "Online" status, and controls to reset the conversation and close
 * the panel. Styled to match the RecruitFlow AI theme (primary-blue gradient,
 * Poppins heading, soft rounded controls).
 */
export function RivaHeader({
  onClose,
  onReset,
}: {
  onClose: () => void;
  onReset: () => void;
}) {
  return (
    <div className="relative flex items-center gap-3 bg-gradient-to-br from-primary to-[#2e48c4] px-4 py-3.5 text-white">
      {/* Soft decorative glow, purely cosmetic. */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120px_80px_at_15%_-20%,rgba(255,255,255,0.35),transparent)]" />

      <div className="relative shrink-0">
        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-white shadow-md ring-2 ring-white/60">
          <Image src="/logo/chatbot-avatar.svg" alt="Riva" width={40} height={40} className="h-10 w-10" />
        </div>
        <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-shortlisted" />
      </div>

      <div className="relative min-w-0 flex-1">
        <p className="font-poppins text-sm font-semibold leading-tight">Riva</p>
        <p className="flex items-center gap-1.5 text-xs text-white/90">
        {/*  <span className="inline-block h-1.5 w-1.5 rounded-full bg-shortlisted" /> */}
           AI Career Assistant
        </p>
      </div>

      <button
        type="button"
        onClick={onReset}
        className="relative rounded-lg p-1.5 text-white/80 transition hover:bg-white/15 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        aria-label="Start a new conversation"
        title="Start over"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
          <path d="M3 3v5h5" />
        </svg>
      </button>
      <button
        type="button"
        onClick={onClose}
        className="relative rounded-lg p-1.5 text-white/80 transition hover:bg-white/15 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        aria-label="Close chat"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
