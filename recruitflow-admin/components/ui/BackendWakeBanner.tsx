"use client";

import { useEffect, useState } from "react";

/**
 * A slim top banner shown while the backend cold-starts.
 *
 * The API client (lib/api.ts) dispatches `backend:waking` when it starts
 * retrying through Render's free-tier spin-up (~40-60s) and `backend:awake`
 * once the backend responds. This turns an otherwise invisible wait — where a
 * click seems to do nothing — into a clear, reassuring status instead of a
 * timeout error.
 */
export function BackendWakeBanner() {
  const [waking, setWaking] = useState(false);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const onWaking = () => setWaking(true);
    const onAwake = () => setWaking(false);
    window.addEventListener("backend:waking", onWaking);
    window.addEventListener("backend:awake", onAwake);
    return () => {
      window.removeEventListener("backend:waking", onWaking);
      window.removeEventListener("backend:awake", onAwake);
    };
  }, []);

  useEffect(() => {
    if (!waking) {
      setSeconds(0);
      return;
    }
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [waking]);

  if (!waking) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-[100] flex items-center justify-center gap-3 bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-md font-inter"
    >
      <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white/40 border-t-white" />
      <span>
        Waking up the server — this can take up to a minute on the first request.
        Hang tight{seconds > 3 ? ` (${seconds}s)` : ""}…
      </span>
    </div>
  );
}
