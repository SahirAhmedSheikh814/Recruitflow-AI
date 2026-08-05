"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronRight, Plus, X } from "lucide-react";

import { FAQ_CATEGORIES } from "@/components/site/faqData";
import { FAQBackground } from "@/components/site/FAQBackground";
import Reveal from "@/components/site/Reveal";

/**
 * FAQ page (PRD). Floating white card on a soft brand-blue decorative gradient.
 * Left: category list (one active at a time). Right: accordion question list for
 * the active category (one open at a time). Switching category resets the open
 * question to the first. Reference layout, RecruitFlow AI brand-blue light theme.
 */
export default function FAQPage() {
  const [activeCategory, setActiveCategory] = useState(0);
  const [openQuestion, setOpenQuestion] = useState<number | null>(0);
  const reduce = useReducedMotion();

  const category = FAQ_CATEGORIES[activeCategory];

  const selectCategory = (index: number) => {
    setActiveCategory(index);
    setOpenQuestion(0); // new category opens its first question by default
  };

  const toggleQuestion = (index: number) => {
    setOpenQuestion((current) => (current === index ? null : index));
  };

  return (
    <section className="relative overflow-hidden px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <FAQBackground />

      <div className="relative mx-auto max-w-6xl">
        <div className="relative overflow-hidden rounded-3xl bg-white p-8 shadow-2xl sm:p-12 lg:p-16">
          {/* Faint accent dots near the card corners */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-10 top-8 h-3 w-3 rounded-full bg-primary/20"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-14 top-16 h-2.5 w-2.5 rounded-full bg-primary/25"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-10 left-1/3 h-2.5 w-2.5 rounded-full bg-primary/15"
          />

          {/* Heading + subheading */}
          <Reveal direction="up">
            <h1 className="text-center font-poppins text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl lg:text-5xl">
              Frequently Asked Questions
            </h1>
          </Reveal>
          <Reveal direction="up" delay={0.12}>
            <p className="mx-auto mt-4 max-w-3xl text-center text-base leading-relaxed text-zinc-500 lg:text-lg">
              Everything you need to know about hiring and getting hired with
              RecruitFlow AI — for recruiters, candidates, and everyone in between.
            </p>
          </Reveal>

          {/* Two-column: category list / question accordion */}
          <div className="mt-12 flex flex-col gap-8 lg:mt-14 lg:grid lg:grid-cols-[minmax(0,35%)_1fr] lg:gap-10">
            {/* Left — categories */}
            <div className="space-y-3">
              {FAQ_CATEGORIES.map((cat, i) => {
                const active = i === activeCategory;
                return (
                  <button
                    key={cat.name}
                    type="button"
                    onClick={() => selectCategory(i)}
                    aria-pressed={active}
                    className={`flex w-full items-center justify-between rounded-xl px-5 py-4 text-left font-poppins transition-all duration-200 ${
                      active
                        ? "border-2 border-primary/30 bg-white font-semibold text-zinc-900 shadow-md"
                        : "border border-zinc-200 bg-zinc-50 font-medium text-zinc-600 hover:border-primary/30 hover:text-zinc-900"
                    }`}
                  >
                    <span>{cat.name}</span>
                    <ChevronRight
                      className={`h-5 w-5 shrink-0 transition-colors ${
                        active ? "text-primary" : "text-zinc-400"
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            {/* Right — questions for the active category (fades on category switch) */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeCategory}
                initial={reduce ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, y: -8 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="space-y-3"
              >
                {category.questions.map((item, i) => {
                  const open = openQuestion === i;
                  return (
                    <div
                      key={item.question}
                      className={
                        open
                          ? "rounded-xl border-2 border-primary/30 bg-primary/5 p-6 shadow-sm"
                          : "rounded-lg border border-zinc-200 bg-white transition-colors hover:border-primary/40"
                      }
                    >
                      <button
                        type="button"
                        onClick={() => toggleQuestion(i)}
                        aria-expanded={open}
                        className={`flex w-full items-start justify-between gap-4 text-left ${
                          open ? "" : "px-5 py-4"
                        }`}
                      >
                        <span
                          className={`font-poppins ${
                            open
                              ? "text-lg font-semibold text-zinc-900"
                              : "font-medium text-zinc-700"
                          }`}
                        >
                          {item.question}
                        </span>
                        {open ? (
                          <X className="h-5 w-5 shrink-0 text-zinc-600 transition-colors hover:text-primary" />
                        ) : (
                          <Plus className="h-5 w-5 shrink-0 text-zinc-400" />
                        )}
                      </button>

                      <AnimatePresence initial={false}>
                        {open && (
                          <motion.div
                            initial={reduce ? false : { height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={reduce ? undefined : { height: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                            className="overflow-hidden"
                          >
                            <p className="mt-4 text-base leading-relaxed text-zinc-600">
                              {item.answer}
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
