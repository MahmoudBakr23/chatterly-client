"use client";

// ─── Input component ──────────────────────────────────────────────────────────
// A controlled text input that integrates with react-hook-form via forwardRef.
// react-hook-form's register() function returns a ref callback — forwardRef is
// required for it to gain direct DOM access (focus, blur, value reading).
//
// Error state: pass error={formState.errors.fieldName?.message} to show
// a validation message below the input. Validation rules are defined with Zod
// in the form schema (components/auth/*-form.tsx) and resolved by @hookform/resolvers.

import { type InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  // Error message string from react-hook-form — renders a red hint below the field
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, type = "text", ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1">
        <input
          ref={ref}
          type={type}
          className={cn(
            // Base: full-width, consistent height, standard border
            "bg-surface text-foreground w-full rounded-md border px-3 py-2 text-sm",
            // Placeholder: muted color from design tokens
            "placeholder:text-muted",
            // Default border vs error border — communicates validation state
            error ? "border-destructive" : "border-border",
            // Transition on border color — smooth state change on validation
            "transition-colors duration-150",
            // Disabled: same visual language as Button — dim + no-pointer
            "disabled:cursor-not-allowed disabled:opacity-50",
            // Focus: use outline from globals.css :focus-visible, remove default ring
            "focus-visible:ring-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
            className,
          )}
          // aria-invalid tells screen readers this field has an error —
          // required for WCAG 1.3.1 (Info and Relationships)
          aria-invalid={error ? "true" : undefined}
          {...props}
        />

        {/* Validation error message */}
        {error && (
          <p className="text-destructive text-xs" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";

export { Input };
export type { InputProps };
