import Link from "next/link";
import Image from "next/image";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-white via-zinc-50 to-zinc-100 px-4 py-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px]"
        style={{
          background:
            "radial-gradient(60% 100% at 50% 0%, rgba(74,108,247,0.08) 0%, rgba(74,108,247,0.03) 40%, transparent 75%)",
        }}
      />
      <div className="relative w-full max-w-md">
        <Link
          href="/"
          className="mb-10 block text-center transition-opacity hover:opacity-80"
          aria-label="RecruitFlow AI home"
        >
          <Image
            src="/Logos/Recruitflow-logo-optimized.png"
            alt="RecruitFlow AI"
            width={532}
            height={132}
            className="mx-auto h-12 w-auto"
          />
        </Link>
        <div className="rounded-3xl border border-zinc-200/80 bg-white p-8 shadow-[0_8px_40px_rgba(0,0,0,0.06)] ring-1 ring-zinc-900/5 sm:p-10">
          {children}
        </div>
        <p className="mt-8 text-center text-xs leading-relaxed text-zinc-500">
          Recruiter Portal
          <span className="mx-2 text-zinc-300">·</span>
          <span className="text-zinc-400">Powered by RecruitFlow AI</span>
        </p>
      </div>
    </div>
  );
}
