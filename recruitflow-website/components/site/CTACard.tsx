import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import Reveal from "./Reveal";

/**
 * CTA banner — full-width rounded card near the bottom of the home page.
 *
 * Background photo with a dark gradient overlay for legibility; content pinned
 * lower-left (heading, paragraph, pill CTA with trailing white arrow badge).
 * Layout, sizing, and animation match the 3PL Dynamics donation-card reference
 * exactly — only the content is RecruitFlow AI's own.
 *
 * Swap the background by changing CTA_BG below once the real asset is provided.
 */
const CTA_BG = "/cta-card/cta-bg.webp";

const CTACard = () => {
  return (
    <section className="px-4 py-12 sm:px-6 md:py-16 lg:px-10 lg:py-20">
      <div
        className="relative mx-auto flex min-h-[380px] w-full max-w-[1600px] items-end overflow-hidden rounded-3xl bg-cover bg-center shadow-xl md:min-h-[440px] lg:min-h-[500px]"
        style={{ backgroundImage: `url(${CTA_BG})` }}
      >
        {/* Dark gradient for text legibility — strongest at the lower-left */}
        <div className="absolute inset-0 bg-gradient-to-tr from-black/80 via-black/50 to-black/20" />

        {/* Content, lower-left — heading, paragraph and CTA rise in with a slight stagger */}
        <div className="relative w-full max-w-2xl p-8 sm:p-10 md:p-12 lg:p-16">
          <Reveal direction="up">
            <h2 className="font-poppins text-3xl font-bold leading-tight text-white sm:text-4xl md:text-5xl">
              Start Hiring Smarter Today
            </h2>
          </Reveal>

          <Reveal direction="up" delay={0.12}>
            <p className="mt-4 text-base text-white/80 sm:text-lg md:text-xl">
              Let AI handle the screening so you can focus on the people. Post a
              role, let RecruitFlow AI rank and score your applicants, and
              schedule interviews — all in one place.
            </p>
          </Reveal>

          <Reveal direction="up" delay={0.24}>
            <Link
              href="/signup"
              className="group mt-8 inline-flex items-center gap-3 rounded-full bg-primary py-2 pl-7 pr-2 text-base font-semibold text-white shadow-lg transition-all duration-300 hover:scale-105"
            >
              Get Started Free
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-primary transition-transform duration-300 group-hover:rotate-45">
                <ArrowUpRight className="h-5 w-5" />
              </span>
            </Link>
          </Reveal>
        </div>
      </div>
    </section>
  );
};

export default CTACard;
