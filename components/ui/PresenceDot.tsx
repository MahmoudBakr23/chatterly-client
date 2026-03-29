// ─── PresenceDot ──────────────────────────────────────────────────────────────
// A small coloured dot indicating online/offline status.
// Reads live from the presence store so it updates in real-time as
// PresenceChannel broadcasts arrive — no prop drilling needed.
//
// Backend connection:
//   Indirectly via usePresenceStore, which is populated by usePresence hook
//   subscribing to PresenceChannel (stream: "presence").
//
// Perf notes:
//   Each PresenceDot subscribes only to `onlineUserIds[userId]` via selector,
//   so it re-renders only when that specific user's status changes — not on every
//   presence event for any user.

import { usePresenceStore } from "@/store/presence.store";
import { cn } from "@/lib/utils";

interface PresenceDotProps {
  userId: number;
  // Size of the dot — "sm" for sidebar rows, "md" for thread header
  size?: "sm" | "md";
  className?: string;
}

export function PresenceDot({ userId, size = "sm", className }: PresenceDotProps) {
  // Subscribe narrowly: re-render only when this user's key appears or disappears
  const online = usePresenceStore((state) => userId in state.onlineUserIds);

  // Only render when the user is online — no dot at all for offline users.
  // bg-success via Tailwind class is unreliable in Tailwind v4 without @config
  // in globals.css; use the CSS variable directly via style= instead.
  if (!online) return null;

  return (
    <span
      aria-label="Online"
      className={cn(
        "inline-block flex-shrink-0 rounded-full",
        size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5",
        className,
      )}
      style={{ backgroundColor: "#22c55e" /* green-500 — medium green */ }}
    />
  );
}
