"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { submitApplication, ApiError } from "@/lib/api";

export function ApplyForm({ jobId, jobTitle }: { jobId: string; jobTitle: string }) {
  const pathname = usePathname();
  // Keep post-submit navigation inside whichever surface the form is rendered in:
  // the candidate portal (/portal/…) or the public career site.
  const inPortal = pathname?.startsWith("/portal") ?? false;
  const browseHref = inPortal ? "/portal/jobs" : "/jobs";
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [portfolio, setPortfolio] = useState("");
  const [resume, setResume] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!resume) {
      setError("Please attach your resume (PDF or DOCX).");
      return;
    }
    const name = resume.name.toLowerCase();
    if (!name.endsWith(".pdf") && !name.endsWith(".docx")) {
      setError("Resume must be a PDF or DOCX file.");
      return;
    }

    const form = new FormData();
    form.set("job_id", jobId);
    form.set("full_name", fullName);
    form.set("email", email);
    if (phone) form.set("phone", phone);
    if (location) form.set("current_location", location);
    if (linkedin) form.set("linkedin_url", linkedin);
    if (portfolio) form.set("portfolio_url", portfolio);
    form.set("resume", resume);

    setLoading(true);
    try {
      await submitApplication(form);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border border-shortlisted/30 bg-shortlisted/5 p-8 text-center">
        <h2 className="font-poppins text-xl font-semibold text-zinc-900">Application received 🎉</h2>
        <p className="mt-2 text-zinc-600">
          Thanks for applying to <span className="font-medium">{jobTitle}</span>. We&apos;ll review
          your resume and be in touch. You can track your application status from your candidate
          portal.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href="/portal"
            className="inline-flex h-11 items-center rounded-lg bg-primary px-5 text-sm font-medium font-poppins text-white hover:bg-primary/90"
          >
            Go to my portal
          </Link>
          <Link
            href={browseHref}
            className="inline-flex h-11 items-center rounded-lg border border-zinc-300 bg-white px-5 text-sm font-medium font-poppins text-zinc-900 hover:bg-zinc-50"
          >
            Browse more roles
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {error ? (
        <div className="rounded-lg border border-rejected/30 bg-rejected/5 px-3 py-2 text-sm text-rejected">
          {error}
        </div>
      ) : null}

      <TextField
        label="Full name"
        required
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        placeholder="Jane Candidate"
      />
      <TextField
        label="Email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          label="Phone (optional)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+61 …"
        />
        <TextField
          label="Location (optional)"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Sydney, AU"
        />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          label="LinkedIn (optional)"
          value={linkedin}
          onChange={(e) => setLinkedin(e.target.value)}
          placeholder="linkedin.com/in/…"
        />
        <TextField
          label="Portfolio (optional)"
          value={portfolio}
          onChange={(e) => setPortfolio(e.target.value)}
          placeholder="yoursite.com"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="resume" className="text-sm font-medium text-zinc-700">
          Resume (PDF or DOCX)
        </label>
        <input
          id="resume"
          type="file"
          accept=".pdf,.docx"
          required
          onChange={(e) => setResume(e.target.files?.[0] ?? null)}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-700 file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary hover:file:bg-primary/20"
        />
      </div>

      <Button type="submit" loading={loading} className="w-full">
        Submit application
      </Button>
    </form>
  );
}
