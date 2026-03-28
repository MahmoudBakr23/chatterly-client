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

  return (
    <span
      aria-label={online ? "Online" : "Offline"}
      className={cn(
        "inline-block flex-shrink-0 rounded-full",
        // Green when online, grey when offline
        online ? "bg-success" : "bg-muted",
        size === "sm" ? "h-2 w-2" : "h-2.5 w-2.5",
        className,
      )}
    />
  );
}
