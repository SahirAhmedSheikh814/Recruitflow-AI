"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { GoogleButton } from "@/components/ui/GoogleButton";
import { signup, ApiError } from "@/lib/api";
import { homeForRole } from "@/lib/jwt";

export default function SignupPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      // Public signup always creates a candidate account.
      const user = await signup(email, password, fullName);
      router.push(homeForRole(user.role));
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
          Create your account
        </h1>
        <p className="text-sm leading-relaxed text-zinc-600">
          Apply to roles and track your applications.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="space-y-4">
        <TextField
          label="Full name"
          type="text"
          autoComplete="name"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Jane Candidate"
        />
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
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
        />
      </div>

      <Button type="submit" loading={loading} className="mt-2 w-full">
        Create account
      </Button>

      <div className="flex items-center gap-3">
        <hr className="flex-1 border-zinc-200" />
        <span className="text-xs font-medium text-zinc-400">or</span>
        <hr className="flex-1 border-zinc-200" />
      </div>

      <GoogleButton label="Sign up with Google" />

      <p className="text-center text-sm text-zinc-600">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-semibold text-primary transition-colors hover:text-primary/80"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
