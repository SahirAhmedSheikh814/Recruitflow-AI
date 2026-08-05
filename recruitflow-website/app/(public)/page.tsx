import Link from "next/link";

import { getJobs } from "@/lib/jobs";
import { HomeHero } from "@/components/site/HomeHero";
import FeaturesSection from "@/components/site/FeaturesSection";
import { OpenRolesGrid } from "@/components/site/OpenRolesGrid";
import CTACard from "@/components/site/CTACard";

// Job listings change over time — always render per request, never serve a stale build snapshot.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const jobs = await getJobs();
  const featured = jobs.slice(0, 3);

  return (
    <>
      {/* Hero */}
      <HomeHero />

      {/* Our Features */}
      <FeaturesSection />

      {/* Featured roles */}
      <section className="mx-auto w-full max-w-7xl px-6 py-20 lg:px-8 xl:max-w-[1440px] 2xl:max-w-[1680px] 2xl:px-12">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="font-poppins text-4xl font-bold text-zinc-900 lg:text-5xl">
              Open <span className="text-primary">Roles</span>
            </h2>
            <p className="mt-2 text-base text-zinc-500 lg:text-lg">
              {jobs.length > 0
                ? `${jobs.length} position${jobs.length === 1 ? "" : "s"} currently hiring`
                : "New roles are posted regularly — check back soon."}
            </p>
          </div>
          <Link
            href="/jobs"
            className="group inline-flex items-center gap-1 text-base font-semibold text-primary lg:text-lg"
          >
            View all
            <span
              aria-hidden="true"
              className="inline-block transition-transform duration-200 group-hover:translate-x-1"
            >
              →
            </span>
          </Link>
        </div>

        {featured.length > 0 ? (
          <OpenRolesGrid jobs={featured} />
        ) : (
          <div className="mt-8 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-12 text-center text-zinc-500">
            No open roles right now.
          </div>
        )}
      </section>

      {/* CTA Card */}
      <CTACard />
    </>
  );
}
