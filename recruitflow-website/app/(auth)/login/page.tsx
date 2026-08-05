"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { GoogleButton } from "@/components/ui/GoogleButton";
import { login, ApiError } from "@/lib/api";
import { homeForRole } from "@/lib/jwt";

/** Only allow redirects to internal paths — never to an attacker-supplied URL. */
function safeNext(next: string | null): string | null {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return null;
}

const OAUTH_ERRORS: Record<string, string> = {
  google_denied: "Google sign-in was cancelled.",
  invalid_state: "Your sign-in session expired. Please try again.",
  google_failed: "We couldn't complete Google sign-in. Please try again.",
  google_no_email: "Your Google account didn't share an email address.",
  account_disabled: "This account has been disabled.",
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));
  const oauthError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    oauthError ? (OAUTH_ERRORS[oauthError] ?? "Sign-in failed. Please try again.") : null,
  );
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await login(email, password);
      router.push(next ?? homeForRole(user.role));
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="space-y-1.5">
        <h1 className="font-poppins text-2xl font-bold tracking-tight text-zinc-900">
          Welcome back
        </h1>
        <p className="text-sm leading-relaxed text-zinc-600">
          Sign in to your RecruitFlow account.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <GoogleButton label="Continue with Google" />

      <div className="flex items-center gap-3">
        <hr className="flex-1 border-zinc-200" />
        <span className="text-xs font-medium text-zinc-400">or</span>
        <hr className="flex-1 border-zinc-200" />
      </div>

      <div className="space-y-4">
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
      </div>

      <Button type="submit" loading={loading} className="mt-2 w-full">
        Sign in
      </Button>

      <p className="text-center text-sm text-zinc-600">
        New candidate?{" "}
        <Link
          href="/signup"
          className="font-semibold text-primary transition-colors hover:text-primary/80"
        >
          Create an account
        </Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="h-64" />}>
      <LoginForm />
    </Suspense>
  );
}
