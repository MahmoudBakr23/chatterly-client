// ─── Spinner component ────────────────────────────────────────────────────────
// A pure-CSS animated loading indicator. No images, no libraries, no JS animation.
// CSS-only means it works even when JS is still loading — reliable for initial
// page load states.
//
// Used in:
//   - Full-page hydration (app/(app)/layout.tsx while /api/me resolves)
//   - Button loading states (Button component handles its own inline spinner)
//   - Async data fetches in Phase 2+ (conversation list, message history)

import { cn } from "@/lib/utils";

interface SpinnerProps {
  // Size controls the diameter. "md" is the default general-purpose size.
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap: Record<NonNullable<SpinnerProps["size"]>, string> = {
  sm: "h-4 w-4 border-2",
  md: "h-6 w-6 border-2",
  lg: "h-8 w-8 border-[3px]",
};

export function Spinner({ size = "md", className }: SpinnerProps) {
  return (
    <span
      // The spinner is decorative — aria-hidden hides it from screen readers.
      // The surrounding component should provide a text status via aria-live
      // or sr-only text (see usage in layout.tsx hydration state).
      aria-hidden="true"
      className={cn(
        "inline-block animate-spin rounded-full",
        // border-current inherits the color from the text-* class on the parent.
        // border-t-transparent creates the "gap" that makes it look like it's spinning.
        "border-current border-t-transparent",
        sizeMap[size],
        className,
      )}
    />
  );
}
