"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  getCalendarConnectUrl,
  getRecruiterProfile,
  updateRecruiterProfile,
  type RecruiterProfile,
} from "@/lib/api";

function SettingsInner() {
  const params = useSearchParams();
  const [profile, setProfile] = useState<RecruiterProfile | null>(null);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("17:00");
  const [company, setCompany] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [calError, setCalError] = useState<string | null>(null);

  useEffect(() => {
    getRecruiterProfile().then((p) => {
      setProfile(p);
      setStart(p.working_hours_start);
      setEnd(p.working_hours_end);
      setCompany(p.company_name ?? "");
    });
  }, []);

  // The calendar OAuth callback redirects back here with ?calendar=error when the
  // Google connection failed (invalid state, code exchange rejected, etc.).
  useEffect(() => {
    if (params.get("calendar") === "error") {
      setCalError("Couldn't connect Google Calendar. Please try connecting again.");
    }
  }, [params]);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      const p = await updateRecruiterProfile({
        company_name: company,
        working_hours_start: start,
        working_hours_end: end,
      });
      setProfile(p);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  async function connectCalendar() {
    setCalError(null);
    try {
      const { authorization_url } = await getCalendarConnectUrl();
      window.location.href = authorization_url;
    } catch {
      setCalError("Google Calendar isn't configured on the server yet.");
    }
  }

  const connected = profile?.google_calendar_connected || params.get("calendar") === "connected";

  return (
    <div className="max-w-2xl">
      <h1 className="font-poppins text-2xl font-bold text-zinc-900">Settings</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Your working hours constrain the slots the Scheduling Agent offers candidates.
      </p>

      <Card className="mt-6">
        <h2 className="font-poppins font-semibold text-zinc-900">Profile & working hours</h2>
        <div className="mt-4 flex flex-col gap-4">
          <label className="text-sm">
            <span className="text-zinc-600">Company name</span>
            <input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
            />
          </label>
          <div className="flex gap-4">
            <label className="flex-1 text-sm">
              <span className="text-zinc-600">Working hours start</span>
              <input
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
              />
            </label>
            <label className="flex-1 text-sm">
              <span className="text-zinc-600">Working hours end</span>
              <input
                type="time"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
              />
            </label>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={save} loading={saving}>
              Save
            </Button>
            {saved && <span className="text-sm text-shortlisted">Saved.</span>}
          </div>
        </div>
      </Card>

      <Card className="mt-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-poppins font-semibold text-zinc-900">Google Calendar</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Connect your calendar so the Scheduling Agent can read your availability and book interviews.
            </p>
          </div>
          {connected ? (
            <Badge tone="shortlisted">Connected</Badge>
          ) : (
            <Button variant="secondary" onClick={connectCalendar}>
              Connect
            </Button>
          )}
        </div>
        {calError && <p className="mt-3 text-sm text-rejected">{calError}</p>}
      </Card>
    </div>
  );
}

export default function RecruiterSettingsPage() {
  return (
    <Suspense fallback={<div className="py-16 text-center text-zinc-400">Loading…</div>}>
      <SettingsInner />
    </Suspense>
  );
}
