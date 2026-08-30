"use client";

import Image from "next/image";

/**
 * "Riva is typing" indicator, shown while a reply is in flight. Mirrors the
 * assistant message layout (avatar + bubble) so it feels like a message forming.
 */
export function RivaTyping() {
  return (
    <div className="flex items-start gap-2" aria-label="Riva is typing" role="status">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-zinc-200">
        <Image src="/logo/chatbot-avatar.svg" alt="" width={28} height={28} className="h-7 w-7" />
      </span>
      <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-md border border-zinc-100 bg-white px-3.5 py-3 shadow-sm">
        <span className="h-2 w-2 animate-bounce rounded-full bg-primary/60 [animation-delay:-0.3s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-primary/60 [animation-delay:-0.15s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-primary/60" />
      </div>
    </div>
  );
}
