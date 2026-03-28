"use client";

// ─── MessageInput ─────────────────────────────────────────────────────────────
// The text input bar at the bottom of the message thread.
// Handles composing and submitting messages via react-hook-form + zod.
//
// Backend connection:
//   Calls sendMessage() → POST /api/v1/conversations/:id/messages
//   The backend broadcasts the new message via ConversationChannel to all
//   subscribers (including the sender). The store is updated from the broadcast,
//   NOT from this component's submit handler, to avoid duplicates.
//
// UX notes:
//   - Enter sends the message; Shift+Enter inserts a newline (textarea behaviour).
//   - The textarea auto-grows up to 5 lines to handle longer messages without a
//     fixed height causing clipping.
//   - A spinner replaces the send button while the request is in flight.

import { useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { sendMessage } from "@/services/messages.service";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

const schema = z.object({
  content: z.string().min(1).max(4000),
});

type FormValues = z.infer<typeof schema>;

interface MessageInputProps {
  conversationId: number;
}

export function MessageInput({ conversationId }: MessageInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { content: "" },
  });

  // Reset textarea height when content clears (after submit or manual delete).
  // We do this in an effect rather than in onSubmit so the ref is never accessed
  // inside a function passed to handleSubmit at render time (react-hooks/refs rule).
  const content = watch("content");
  useEffect(() => {
    if (!content && textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [content]);

  // Auto-resize the textarea as the user types.
  function handleInput() {
    const el = textareaRef.current;
    if (!el) return;
    // Reset height so shrinkage works when text is deleted
    el.style.height = "auto";
    // Cap at ~5 lines (5 × 24px line-height + padding)
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }

  async function onSubmit(values: FormValues) {
    // sendMessage fires the HTTP request. The store update comes from the
    // Action Cable broadcast that Rails triggers on create — not from here.
    // This keeps the UI update path consistent for all clients (sender included).
    await sendMessage(conversationId, values.content.trim());
    // reset() sets content to "" — the useEffect above catches that change
    // and resets the textarea height without touching a ref here at render time.
    reset();
  }

  // Intercept Enter key: submit on plain Enter, allow newline on Shift+Enter.
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(onSubmit)();
    }
  }

  // Merge react-hook-form's ref with our local ref for auto-resize
  const { ref: rhfRef, ...restRegister } = register("content");

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="border-border bg-surface flex items-end gap-2 border-t px-4 py-3"
    >
      <textarea
        {...restRegister}
        ref={(el) => {
          // Attach both refs: react-hook-form needs its ref, we need ours for resize
          rhfRef(el);
          (textareaRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
        }}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        placeholder="Message…"
        rows={1}
        disabled={isSubmitting}
        className={cn(
          "flex-1 resize-none overflow-hidden rounded-[var(--radius-md)]",
          "border-border bg-background border px-3 py-2",
          "text-foreground placeholder:text-muted text-sm",
          "focus:border-accent focus:outline-none",
          "disabled:opacity-50",
          // Smooth height transitions when auto-growing
          "transition-[height]",
        )}
      />

      {/* Send button */}
      <button
        type="submit"
        disabled={isSubmitting}
        aria-label="Send message"
        className={cn(
          "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[var(--radius-md)]",
          "bg-accent text-accent-foreground transition-colors",
          "hover:bg-accent-hover",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        {isSubmitting ? (
          <Spinner size="sm" />
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        )}
      </button>
    </form>
  );
}
