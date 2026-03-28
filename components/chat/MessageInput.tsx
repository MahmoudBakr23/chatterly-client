"use client";

// ─── MessageInput ─────────────────────────────────────────────────────────────
// The text input bar at the bottom of the message thread.
// Handles composing and submitting messages via react-hook-form + zod.
// Phase 3: adds an emoji picker button that opens inline above the input.
//
// Backend connection:
//   Calls sendMessage() → POST /api/v1/conversations/:id/messages
//   The backend broadcasts the new message via ConversationChannel to all
//   subscribers (including the sender). The store is updated from the broadcast,
//   NOT from this component's submit handler, to avoid duplicates.
//
// UX notes:
//   - Enter sends; Shift+Enter inserts a newline.
//   - Textarea auto-grows up to 5 lines.
//   - Emoji picker is lazy-loaded (dynamic import) — not in the initial bundle.
//   - Clicking outside the picker closes it (handled by the picker's own onEmojiClick).
//   - A spinner replaces the send button while the request is in flight.

import { useRef, useEffect, useState, lazy, Suspense } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { sendMessage } from "@/services/messages.service";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

// Lazy-load the picker — it's ~200 KB and only needed when the emoji button is clicked.
// Suspense fallback is a spinner so the button doesn't cause a layout shift.
const EmojiPicker = lazy(() => import("emoji-picker-react"));

const schema = z.object({
  content: z.string().min(1).max(4000),
});

type FormValues = z.infer<typeof schema>;

interface MessageInputProps {
  conversationId: number;
}

export function MessageInput({ conversationId }: MessageInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pickerContainerRef = useRef<HTMLDivElement>(null);
  const [showPicker, setShowPicker] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    getValues,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { content: "" },
  });

  // Reset textarea height when content clears after submit.
  const content = watch("content");
  useEffect(() => {
    if (!content && textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [content]);

  // Close the picker when clicking outside it.
  useEffect(() => {
    if (!showPicker) return;

    function handleClickOutside(e: MouseEvent) {
      if (pickerContainerRef.current && !pickerContainerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showPicker]);

  function handleInput() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }

  async function onSubmit(values: FormValues) {
    try {
      await sendMessage(conversationId, values.content.trim());
      reset();
      setShowPicker(false);
    } catch {
      toast.error("Failed to send message. Please try again.");
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(onSubmit)();
    }
  }

  // Append the selected emoji to the current content at the end.
  // emoji-picker-react v5 passes an EmojiClickData object.
  function handleEmojiClick(emojiData: { emoji: string }) {
    const current = getValues("content");
    setValue("content", current + emojiData.emoji, { shouldValidate: true });
    // Refocus textarea so the user can keep typing without clicking
    textareaRef.current?.focus();
  }

  const { ref: rhfRef, ...restRegister } = register("content");

  return (
    <div className="border-border bg-surface border-t">
      {/* ── Emoji picker popover ──────────────────────────────────────────────
          Rendered above the input row. Lazy-loaded on first open.             */}
      {showPicker && (
        <div ref={pickerContainerRef} className="px-4 pt-2">
          <Suspense
            fallback={
              <div className="flex h-24 items-center justify-center">
                <Spinner size="sm" className="text-muted" />
              </div>
            }
          >
            <EmojiPicker
              onEmojiClick={handleEmojiClick}
              // Constrain width to the input area; height matches a standard picker
              width="100%"
              height={340}
              // Disable skin tone picker for a simpler UI (Phase 5 polish can add it)
              skinTonesDisabled
            />
          </Suspense>
        </div>
      )}

      {/* ── Input row ─────────────────────────────────────────────────────────*/}
      <form onSubmit={handleSubmit(onSubmit)} className="flex items-end gap-2 px-4 py-3">
        {/* Emoji toggle button */}
        <button
          type="button"
          onClick={() => setShowPicker((prev) => !prev)}
          aria-label="Open emoji picker"
          aria-pressed={showPicker}
          className={cn(
            "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[var(--radius-md)]",
            "border-border border transition-colors",
            showPicker
              ? "bg-accent-muted border-accent text-accent"
              : "bg-surface text-muted hover:bg-surface-muted hover:text-foreground",
          )}
        >
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
            <circle cx="12" cy="12" r="10" />
            <path d="M8 14s1.5 2 4 2 4-2 4-2" />
            <line x1="9" y1="9" x2="9.01" y2="9" />
            <line x1="15" y1="9" x2="15.01" y2="9" />
          </svg>
        </button>

        <textarea
          {...restRegister}
          ref={(el) => {
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
    </div>
  );
}
