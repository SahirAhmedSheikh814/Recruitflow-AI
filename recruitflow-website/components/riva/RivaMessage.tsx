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
      <div className="flex justify-end">
        <div className="max-w-[80%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-gradient-to-br from-primary to-[#3a5bef] px-3.5 py-2 text-sm text-white shadow-sm">
          {message.content}
        </div>
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
