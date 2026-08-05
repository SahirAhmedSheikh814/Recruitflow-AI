"use client";

import type { CSSProperties, ReactNode } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";

type Direction = "up" | "left" | "right";

/**
 * Scroll-triggered fade/slide-in wrapper (direction-aware), used by the Features
 * gallery for both the desktop stagger and the mobile alternating slide-in.
 *
 * - direction: which way the element travels in from ("up" | "left" | "right").
 * - amount:    viewport fraction that must be visible before it fires.
 * - delay:     stagger delay in seconds.
 * - forwards onMouseEnter/onMouseLeave/style/className so it can double as the
 *   hover target for the desktop hover-expand grid (matches the reference API).
 * - respects prefers-reduced-motion: renders instantly, no transform.
 */
const OFFSET = 40;

const buildVariants = (direction: Direction): Variants => {
  const hidden =
    direction === "up"
      ? { opacity: 0, y: OFFSET }
      : direction === "left"
        ? { opacity: 0, x: -OFFSET }
        : { opacity: 0, x: OFFSET };

  return {
    hidden,
    visible: { opacity: 1, x: 0, y: 0 },
  };
};

export default function Reveal({
  children,
  direction = "up",
  amount = 0.2,
  delay = 0,
  className,
  style,
  onMouseEnter,
  onMouseLeave,
}: {
  children: ReactNode;
  direction?: Direction;
  amount?: number;
  delay?: number;
  className?: string;
  style?: CSSProperties;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  const reduce = useReducedMotion();

  if (reduce) {
    // No entrance animation — show immediately, but keep it a hover target.
    return (
      <div
        className={className}
        style={style}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        {children}
      </div>
    );
  }

  return (
    <motion.div
      className={className}
      style={style}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      variants={buildVariants(direction)}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
