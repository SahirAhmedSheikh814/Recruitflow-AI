"use client";

import { motion } from "framer-motion";

/**
 * Clickable suggestion chips shown beneath Riva's opening greeting. Each chip
 * sends its exact label into the chat as if the candidate had typed it, so the
 * two most common intents are one tap away. They disappear once the
 * conversation is under way (the parent only renders them on the greeting).
 */

const SUGGESTIONS = ["View open roles", "I want to apply for a job"] as const;

export function RivaSuggestions({
  onPick,
  disabled,
}: {
  onPick: (text: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-2 pl-9">
      {SUGGESTIONS.map((label, i) => (
        <motion.button
          key={label}
          type="button"
          onClick={() => onPick(label)}
          disabled={disabled}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 + i * 0.08, duration: 0.25 }}
          whileHover={{ scale: disabled ? 1 : 1.04 }}
          whileTap={{ scale: disabled ? 1 : 0.96 }}
          className="rounded-full border border-primary/30 bg-primary/5 px-3.5 py-1.5 text-xs font-medium text-primary shadow-sm transition-colors hover:border-primary hover:bg-primary hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {label}
        </motion.button>
      ))}
    </div>
  );
}
