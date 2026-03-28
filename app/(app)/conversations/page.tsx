// ─── Conversations landing page ───────────────────────────────────────────────
// Shown on desktop when no conversation is selected.
// On mobile this page is never visible — the layout hides it and shows the
// sidebar (ConversationList) as the full-screen primary view instead.

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Chatterly",
};

export default function ConversationsPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center p-8">
      {/* Brand icon */}
      <div className="bg-accent-muted flex h-16 w-16 items-center justify-center rounded-full">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="text-accent"
          aria-hidden="true"
        >
          <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2.546 20.7a.75.75 0 0 0 .956.93l3.684-1.452A9.956 9.956 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2Z" />
        </svg>
      </div>

      <div className="max-w-xs">
        <p className="text-foreground text-base font-semibold">Your messages</p>
        <p className="text-muted mt-1 text-sm leading-relaxed">
          Pick a conversation from the sidebar, or hit the{" "}
          <span className="text-foreground font-medium">compose button</span> to start a new one.
        </p>
      </div>
    </div>
  );
}
