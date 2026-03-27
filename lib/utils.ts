import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// ─── cn() — conditional class name helper ───────────────────────────────────
// Combines clsx (conditional logic) with tailwind-merge (conflict resolution).
//
// Why both?
//   clsx handles conditions:  cn("base", isActive && "bg-accent")
//   tailwind-merge resolves conflicts: cn("p-4", "p-2") → "p-2" (not "p-4 p-2")
//   Without tailwind-merge, Tailwind's CSS specificity rules would determine the
//   winner unpredictably — tailwind-merge makes it deterministic (last wins).
//
// This is the idiomatic helper for Tailwind + React. Every component uses it.
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// ─── formatRelativeTime() ────────────────────────────────────────────────────
// Converts an ISO 8601 timestamp (from the backend's created_at / updated_at)
// into a human-readable relative string: "just now", "5m ago", "2h ago", "Mon".
//
// Performance note: Intl.RelativeTimeFormat is instantiated per call here.
// If this becomes a hot path (e.g. a message list rendering 100+ items), consider
// memoizing the formatter instance at module level.
export function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) {
    // Show day name for recent messages within a week
    return date.toLocaleDateString("en-US", { weekday: "short" });
  }
  // Older: show date
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── getInitials() ───────────────────────────────────────────────────────────
// Generates a 1-2 letter avatar placeholder from a display name or username.
// Used when avatar_url is null — the backend stores this as nullable.
export function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}
