"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { ApiError, getCurrentUser, submitApplication } from "@/lib/api";
import {
  clearRivaConversation,
  getRivaConversation,
  reportRivaOutcome,
  sendRivaMessage,
  type RivaMessage as RivaMessageType,
  type RivaSubmission,
} from "@/lib/riva";
import { RivaComposer } from "@/components/riva/RivaComposer";
import { RivaHeader } from "@/components/riva/RivaHeader";
import { RivaMessage } from "@/components/riva/RivaMessage";
import { RivaSuggestions } from "@/components/riva/RivaSuggestions";
import { RivaTyping } from "@/components/riva/RivaTyping";

const GREETING: RivaMessageType = {
  id: "__greeting__",
  role: "assistant",
  content:
    "Hi! I'm **Riva**, your AI Career Assistant. I can show you open roles, " +
    "explain a job, check your applications, or help you apply just attach your " +
    "résumé with the paperclip when you're ready. What would you like to do?",
  created_at: "",
};

/**
 * Riva chat widget — candidate-only. Rendered once in the Candidate Dashboard
 * layout. Fixed to the bottom-right corner on every breakpoint, layered above
 * dashboard content (z-[70]/[80]) but below the backend-wake banner (z-[100]).
 *
 * Riva collects application details through chat; when the backend signals the
 * draft is ready (a `submission` object), this widget performs the actual
 * submission through the SAME `submitApplication` → POST /applications path the
 * web form uses, attaching the résumé File it holds. Riva never submits server-side.
 */
export function RivaWidget() {
  const [isCandidate, setIsCandidate] = useState(false);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [messages, setMessages] = useState<RivaMessageType[]>([]);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  // The résumé File is cleared from the composer preview the moment it's sent,
  // but the bytes must survive until the (possibly later) submission turn — so
  // we retain the most recent attachment here across turns.
  const retainedFileRef = useRef<File | null>(null);
  const prefersReduced = useReducedMotion();

  // Only candidates ever see Riva. The portal layout is already candidate-only
  // (server-enforced), but this guards against accidental reuse elsewhere.
  useEffect(() => {
    getCurrentUser()
      .then((u) => setIsCandidate(u.role === "candidate"))
      .catch(() => setIsCandidate(false));
  }, []);

  const displayed = messages.length > 0 ? messages : [GREETING];

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [displayed.length, busy, open]);

  // Load the transcript the first time the panel is opened.
  const loadConversation = useCallback(async () => {
    try {
      const convo = await getRivaConversation();
      setMessages(convo.messages);
    } catch {
      // Leave the greeting in place; the composer still works.
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (open && !loaded) void loadConversation();
  }, [open, loaded, loadConversation]);

  // Perform the actual application submission via the existing endpoint.
  async function performSubmission(submission: RivaSubmission, file: File | null) {
    if (!file) {
      // The draft is ready server-side, but the in-browser File was lost (e.g. a
      // page reload). Ask Riva to prompt for it again and clear the ready flag.
      const outcome = await reportRivaOutcome({
        success: false,
        error: "the résumé attachment was lost — please attach it again",
      });
      setMessages((prev) => [...prev, outcome.assistant_message]);
      return;
    }
    try {
      const form = new FormData();
      form.set("job_id", submission.job_id);
      form.set("full_name", submission.full_name);
      form.set("email", submission.email);
      form.set("resume", file);
      const app = await submitApplication(form);
      const outcome = await reportRivaOutcome({
        success: true,
        application_id: app.id,
      });
      setMessages((prev) => [...prev, outcome.assistant_message]);
      setAttachedFile(null);
      retainedFileRef.current = null;
    } catch (err) {
      const detail =
        err instanceof ApiError ? err.message : "an unexpected error occurred";
      const outcome = await reportRivaOutcome({ success: false, error: detail });
      setMessages((prev) => [...prev, outcome.assistant_message]);
    }
  }

  async function handleSend(text: string) {
    if (busy) return;
    const trimmed = text.trim();
    const fileForTurn = attachedFile;
    if (!trimmed && !fileForTurn) return;

    setBusy(true);
    // Retain the File for the eventual submission turn, then clear the composer
    // preview immediately so the attachment chip disappears from the input.
    if (fileForTurn) {
      retainedFileRef.current = fileForTurn;
      setAttachedFile(null);
    }

    const now = Date.now();
    // A session-only bubble representing the attached résumé (icon + filename).
    const fileBubble: RivaMessageType | null = fileForTurn
      ? {
          id: `__file__${now}`,
          role: "user",
          content: "",
          created_at: new Date().toISOString(),
          attachment: { name: fileForTurn.name },
        }
      : null;
    // Optimistic bubble for the typed text (omitted for a file-only send).
    const optimistic: RivaMessageType | null = trimmed
      ? {
          id: `__local__${now}`,
          role: "user",
          content: trimmed,
          created_at: new Date().toISOString(),
        }
      : null;

    setMessages((prev) => {
      const base = prev.length ? prev : [];
      const additions = [fileBubble, optimistic].filter(
        (m): m is RivaMessageType => m !== null,
      );
      return [...base, ...additions];
    });

    // Ensure Riva always receives a message, even when only a file was sent.
    const backendContent =
      trimmed || `I've attached my résumé: ${fileForTurn?.name ?? ""}`.trim();

    try {
      const res = await sendRivaMessage(backendContent, fileForTurn?.name);
      // Swap the optimistic text bubble for the server's canonical pair; keep
      // the local file bubble (the server doesn't echo attachments). For a
      // file-only send, don't render the synthesized user message.
      setMessages((prev) => {
        const withoutOptimistic = optimistic
          ? prev.filter((m) => m.id !== optimistic.id)
          : prev;
        const serverUser = trimmed ? [res.user_message] : [];
        return [...withoutOptimistic, ...serverUser, res.assistant_message];
      });
      if (res.submission) {
        await performSubmission(res.submission, retainedFileRef.current);
      }
    } catch (err) {
      const content =
        err instanceof ApiError && err.status === 429
          ? "You're sending messages a little too fast — give me a moment and try again."
          : "Sorry, I couldn't reach the server just now. Please try again in a moment.";
      setMessages((prev) => [
        ...prev,
        {
          id: `__err__${Date.now()}`,
          role: "assistant",
          content,
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    try {
      await clearRivaConversation();
    } catch {
      // ignore — clear locally regardless
    }
    setMessages([]);
    setAttachedFile(null);
    retainedFileRef.current = null;
  }

  if (!isCandidate) return null;

  const showSuggestions = messages.length === 0 && !busy;
  const spring = prefersReduced
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 380, damping: 30 };

  return (
    <>
      {/* Launcher (FAB) — fixed bottom-right, hidden while the panel is open. */}
      <AnimatePresence>
        {!open && (
          <motion.button
            type="button"
            onClick={() => setOpen(true)}
            initial={{ opacity: 0, scale: 0.5, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5, y: 20 }}
            transition={spring}
            whileHover={prefersReduced ? undefined : { scale: 1.06 }}
            whileTap={prefersReduced ? undefined : { scale: 0.92 }}
            className="group fixed bottom-5 right-5 z-[70] flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-[0_10px_30px_-5px_rgba(74,108,247,0.55)] ring-2 ring-primary/20 transition-shadow hover:shadow-[0_14px_40px_-4px_rgba(74,108,247,0.75)] focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/40"
            aria-label="Open Riva, the application assistant"
          >
            {/* Soft pulsing halo (cosmetic; respects reduced motion). */}
            {!prefersReduced && (
              <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-primary/20 [animation-duration:2.5s]" />
            )}
            <span className="flex h-[68px] w-[68px] items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-primary/5 to-primary/10">
              <Image
                src="/logo/chatbot-avatar.svg"
                alt="Riva"
                width={68}
                height={68}
                className="h-[68px] w-[68px] transition-transform duration-300 group-hover:scale-105"
              />
            </span>
            <span className="absolute bottom-1 right-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-shortlisted" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat panel — fixed bottom-right on every breakpoint. */}
      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Riva application assistant"
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
            }}
            initial={{ opacity: 0, scale: 0.9, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 16 }}
            transition={spring}
            style={{ transformOrigin: "bottom right" }}
            className="fixed bottom-5 left-3 right-3 z-[80] flex max-h-[74vh] flex-col overflow-hidden rounded-3xl border border-zinc-200/80 bg-white font-inter shadow-[0_24px_70px_-15px_rgba(23,23,23,0.35)] sm:bottom-6 sm:left-auto sm:right-6 sm:h-[min(620px,74vh)] sm:max-h-none sm:w-[400px] lg:h-[min(660px,80vh)] lg:w-[420px]"
          >
            <RivaHeader onClose={() => setOpen(false)} onReset={handleReset} />
            <div
              ref={scrollRef}
              className="flex-1 space-y-3 overflow-y-auto bg-gradient-to-b from-zinc-50/60 to-white px-3.5 py-4"
            >
              {displayed.map((m) => (
                <RivaMessage key={m.id} message={m} />
              ))}
              {showSuggestions && <RivaSuggestions onPick={handleSend} disabled={busy} />}
              {busy && <RivaTyping />}
            </div>
            <RivaComposer
              onSend={handleSend}
              attachedFile={attachedFile}
              onAttach={setAttachedFile}
              disabled={busy}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
