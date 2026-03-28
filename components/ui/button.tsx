"use client";

// ─── Button component ─────────────────────────────────────────────────────────
// A minimal, accessible button primitive with variant and size support.
// Built from scratch (no shadcn dependency) so we control the exact styling
// and keep the bundle lean — shadcn is ~10kb per component; this is ~1kb.
//
// Variants:
//   default   — accent-colored primary action (submit, confirm)
//   outline   — bordered secondary action (cancel, back)
//   ghost     — text-only tertiary action (links inside panels)
//   destructive — red for delete/leave actions
//
// Sizes:
//   sm / md / lg — scale with the surrounding context

import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

// We extend the native button's HTML attributes so the component accepts all
// standard props (onClick, disabled, type, aria-*, data-*, etc.) automatically.
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg";
  // isLoading disables the button and swaps the content for a spinner.
  // Pattern: pass isLoading={isPending} to a submit button during async operations.
  isLoading?: boolean;
}

const variantClasses: Record<NonNullable<ButtonProps["variant"]>, string> = {
  default: [
    "bg-accent text-accent-foreground",
    "hover:bg-accent-hover",
    "active:scale-[0.98]",
  ].join(" "),

  outline: [
    "border border-border bg-surface text-foreground",
    "hover:bg-surface-muted",
    "active:scale-[0.98]",
  ].join(" "),

  ghost: ["text-foreground", "hover:bg-surface-muted", "active:scale-[0.98]"].join(" "),

  destructive: [
    "bg-destructive text-destructive-foreground",
    "hover:opacity-90",
    "active:scale-[0.98]",
  ].join(" "),
};

const sizeClasses: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-11 px-6 text-base gap-2",
};

// forwardRef: lets parent components attach a ref to the underlying <button> DOM node.
// Required for accessibility (e.g. auto-focus the submit button on modal open).
const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "default",
      size = "md",
      isLoading = false,
      className,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        // disabled when loading OR when caller passes disabled — both should prevent clicks
        disabled={disabled || isLoading}
        className={cn(
          // Base styles common to all variants
          "inline-flex items-center justify-center rounded-md font-medium",
          "transition-all duration-150",
          // Disabled state: dim + no-pointer so the UI communicates non-interactivity
          "disabled:pointer-events-none disabled:opacity-50",
          // Focus ring from globals.css :focus-visible applies automatically
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      >
        {isLoading ? (
          // Inline spinner when loading — keeps button width stable (no layout jump)
          <>
            <span
              className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
              aria-hidden="true"
            />
            <span className="sr-only">Loading…</span>
          </>
        ) : (
          children
        )}
      </button>
    );
  },
);

Button.displayName = "Button";

export { Button };
export type { ButtonProps };
