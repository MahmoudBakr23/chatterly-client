// ─── Conversations landing page ───────────────────────────────────────────────
// The default view when no conversation is selected — the "empty state."
// In most chat apps (Slack, Discord, iMessage) this is the view that prompts the
// user to pick or start a conversation.
//
// Phase 2 will replace this empty state with:
//   - A proper conversation list in the sidebar
//   - A message thread in this area when a conversation is selected
//   - A URL like /conversations/[id] that deep-links to a specific conversation

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Conversations",
};

export default function ConversationsPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
      {/* Simple empty state — communicates what to do next without clutter */}
      <div className="rounded-full bg-surface-muted p-4">
        {/* Minimal chat icon — SVG inline keeps it bundle-free */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-muted"
          aria-hidden="true"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </div>

      <div>
        <p className="text-sm font-medium text-foreground">No conversation selected</p>
        <p className="mt-0.5 text-xs text-muted">
          Choose a conversation from the sidebar, or start a new one.
        </p>
      </div>
    </div>
  );
}
