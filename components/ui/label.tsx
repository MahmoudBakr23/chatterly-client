"use client";

// ─── Label component ──────────────────────────────────────────────────────────
// A semantic <label> element. The htmlFor prop links it to an input by ID,
// enabling:
//   1. Click-to-focus: clicking the label focuses its associated input
//   2. Screen reader association: announced as "<label> text, <input type>" (WCAG 1.3.1)
//
// Always pair Label with an Input using a matching id/htmlFor. This is required
// for accessibility — placeholder text alone is not an accessible label substitute.

import { type LabelHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

type LabelProps = LabelHTMLAttributes<HTMLLabelElement>;

const Label = forwardRef<HTMLLabelElement, LabelProps>(({ className, ...props }, ref) => {
  return (
    <label
      ref={ref}
      className={cn(
        "text-foreground text-sm font-medium",
        // cursor-default prevents the text cursor on click — labels shouldn't look editable
        "cursor-default select-none",
        className,
      )}
      {...props}
    />
  );
});

Label.displayName = "Label";

export { Label };
