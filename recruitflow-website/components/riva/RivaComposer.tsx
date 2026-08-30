"use client";

import { useRef, useState } from "react";

const ACCEPT = ".pdf,.docx";
const VALID_EXT = /\.(pdf|docx)$/i;

/**
 * Message composer: résumé attach (paperclip), text input, send.
 *
 * The attached résumé File is lifted to the parent and held in browser memory —
 * it is never uploaded here. It travels to the backend only when the parent
 * submits the completed application to POST /applications.
 */
export function RivaComposer({
  onSend,
  attachedFile,
  onAttach,
  disabled,
}: {
  onSend: (text: string) => void;
  attachedFile: File | null;
  onAttach: (file: File | null) => void;
  disabled: boolean;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (file && !VALID_EXT.test(file.name)) {
      setError("Please attach a PDF or DOCX file.");
      onAttach(null);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setError(null);
    onAttach(file);
  }

  function submit() {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="border-t border-zinc-200 bg-white px-3 py-2.5">
      {attachedFile && (
        <div className="mb-2 flex items-center gap-2 rounded-lg bg-primary/5 px-2.5 py-1.5 text-xs text-zinc-700">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-primary">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6" />
          </svg>
          <span className="truncate">{attachedFile.name}</span>
          <button
            type="button"
            onClick={() => {
              onAttach(null);
              if (fileRef.current) fileRef.current.value = "";
            }}
            className="ml-auto shrink-0 rounded p-0.5 text-zinc-400 hover:text-rejected"
            aria-label="Remove attached file"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}
      {error && <p className="mb-1.5 px-1 text-xs text-rejected">{error}</p>}
      <div className="flex items-end gap-1.5">
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT}
          onChange={handleFile}
          className="hidden"
          aria-hidden="true"
          tabIndex={-1}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={disabled}
          className="shrink-0 rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50"
          aria-label="Attach résumé (PDF or DOCX)"
          title="Attach résumé"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
        </button>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
          placeholder="Message Riva…"
          className="max-h-28 min-h-[38px] flex-1 resize-none rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-800 placeholder:text-zinc-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 disabled:opacity-50"
        />
        <button
          type="button"
          onClick={submit}
          disabled={disabled || !text.trim()}
          className="shrink-0 rounded-xl bg-primary p-2.5 text-white transition hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Send message"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
}
