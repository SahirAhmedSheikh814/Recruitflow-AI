"use client";

import Image from "next/image";
import { RivaMarkdown } from "@/components/riva/RivaMarkdown";
import type { RivaMessage as RivaMessageType } from "@/lib/riva";

/**
 * One chat bubble. Assistant messages get Riva's avatar and Markdown rendering;
 * the candidate's own messages are right-aligned plain text on the brand colour.
 */
export function RivaMessage({ message }: { message: RivaMessageType }) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex flex-col items-end gap-1.5">
        {message.attachment && (
          <div className="flex max-w-[80%] items-center gap-2.5 rounded-2xl rounded-br-md border border-primary/20 bg-primary/5 px-3 py-2 shadow-sm">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6" />
              </svg>
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-zinc-800">{message.attachment.name}</span>
              <span className="block text-xs text-zinc-500">Résumé attached</span>
            </span>
          </div>
        )}
        {message.content && (
          <div className="max-w-[80%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-gradient-to-br from-primary to-[#3a5bef] px-3.5 py-2 text-sm text-white shadow-sm">
            {message.content}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-zinc-200">
        <Image src="/logo/chatbot-avatar.svg" alt="Riva" width={28} height={28} className="h-7 w-7" />
      </span>
      <div className="max-w-[80%] break-words rounded-2xl rounded-tl-md border border-zinc-100 bg-white px-3.5 py-2 text-sm text-zinc-800 shadow-sm">
        <RivaMarkdown text={message.content} />
      </div>
    </div>
  );
}
