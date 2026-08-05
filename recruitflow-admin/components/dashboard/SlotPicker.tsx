"use client";

import { useMemo, useState } from "react";

/**
 * Reusable calendar / slot picker (Module 15). The recruiter optionally picks a
 * preferred interview date + time; the value is emitted as a local ISO 8601
 * string (no timezone suffix) that the Scheduling Agent treats as a preference.
 * When nothing is picked the caller sends `undefined` and the agent books the
 * earliest suitable slot instead. Fully keyboard-navigable: the date field is a
 * native control and every slot is a focusable button.
 */

const WORK_START = 9; // 09:00
const WORK_END = 17; // 17:00 (last slot starts 16:30)
const SLOT_MINUTES = 30;

function buildSlots(): string[] {
  const slots: string[] = [];
  for (let h = WORK_START; h < WORK_END; h++) {
    for (let m = 0; m < 60; m += SLOT_MINUTES) {
      slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return slots;
}

function todayISODate(): string {
  const now = new Date();
  const tzOffset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - tzOffset).toISOString().slice(0, 10);
}

export function SlotPicker({
  value,
  onChange,
}: {
  /** Current preferred start as `YYYY-MM-DDTHH:mm`, or null for "earliest slot". */
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const slots = useMemo(buildSlots, []);
  const minDate = useMemo(todayISODate, []);

  const [date, setDate] = useState<string>(value ? value.slice(0, 10) : "");
  const time = value && value.length >= 16 ? value.slice(11, 16) : "";

  function pickDate(next: string) {
    setDate(next);
    // Clear any previously chosen time until the recruiter re-selects one.
    onChange(null);
  }

  function pickTime(next: string) {
    if (!date) return;
    if (time === next) {
      onChange(null); // toggle off → back to "earliest slot"
    } else {
      onChange(`${date}T${next}`);
    }
  }

  return (
    <div className="rounded-lg border border-zinc-200 p-3">
      <div className="flex items-center justify-between">
        <label htmlFor="slot-date" className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Preferred date & time
        </label>
        {value && (
          <button
            type="button"
            onClick={() => {
              setDate("");
              onChange(null);
            }}
            className="text-xs font-medium text-primary hover:underline"
          >
            Clear
          </button>
        )}
      </div>

      <input
        id="slot-date"
        type="date"
        min={minDate}
        value={date}
        onChange={(e) => pickDate(e.target.value)}
        className="mt-2 h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-700 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
      />

      {date && (
        <div
          role="listbox"
          aria-label="Available times"
          className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4"
        >
          {slots.map((s) => {
            const active = time === s;
            return (
              <button
                key={s}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => pickTime(s)}
                className={`rounded-lg border px-2 py-1.5 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-primary/40 ${
                  active
                    ? "border-primary bg-primary text-white"
                    : "border-zinc-300 bg-white text-zinc-700 hover:border-primary/50 hover:bg-primary/5"
                }`}
              >
                {s}
              </button>
            );
          })}
        </div>
      )}

      <p className="mt-2 text-xs text-zinc-400">
        {value
          ? "The agent books this slot if it is free within working hours, otherwise the earliest slot after it."
          : "Leave blank to let the agent book the earliest suitable slot."}
      </p>
    </div>
  );
}
