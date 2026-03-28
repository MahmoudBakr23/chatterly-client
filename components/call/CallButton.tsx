"use client";

// ─── CallButton ───────────────────────────────────────────────────────────────
// Renders audio and video call initiation buttons in the conversation thread header.
// Clicking a button:
//   1. POSTs to /api/v1/conversations/:id/calls via initiateCall() (REST)
//   2. Backend creates a CallSession and broadcasts incoming_call to other members
//   3. We store the session ID so we can track call_accepted / call_declined events
//
// Backend connection:
//   initiateCall() → POST /api/v1/conversations/:id/calls
//   Returns CallSession — stored in the call store as the active call
//
// Why two buttons (audio + video)?
//   The backend's CallSession has a call_type field ("audio" | "video").
//   The UI lets the user choose their preferred modality before calling.
//
// Scalability notes:
//   Buttons are disabled while a call is already active (activeCallSessionId set)
//   to prevent double-initiation. Loading state prevents double-clicks.

import { useState } from "react";
import { Phone, Video } from "lucide-react";
import { initiateCall } from "@/services/calls.service";
import { useCallStore } from "@/store/call.store";
import { cn } from "@/lib/utils";

interface CallButtonProps {
  conversationId: number;
  className?: string;
}

export function CallButton({ conversationId, className }: CallButtonProps) {
  const activeCallSessionId = useCallStore((state) => state.activeCallSessionId);
  const setActiveCall = useCallStore((state) => state.setActiveCall);
  const [loading, setLoading] = useState<"audio" | "video" | null>(null);

  // Disabled while already in a call or while initiating one
  const isDisabled = !!activeCallSessionId || !!loading;

  async function handleCall(callType: "audio" | "video") {
    if (isDisabled) return;
    setLoading(callType);

    try {
      const session = await initiateCall(conversationId, callType);
      // Store the active call — useCallChannel will pick up call_accepted via WebSocket
      setActiveCall(session.id, conversationId, callType);
    } catch (err) {
      console.error("[CallButton] initiateCall failed:", err);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {/* Audio call button */}
      <button
        onClick={() => handleCall("audio")}
        disabled={isDisabled}
        title="Audio call"
        aria-label="Start audio call"
        className={cn(
          "text-muted hover:text-foreground hover:bg-surface-muted rounded-md p-1.5 transition-colors",
          "disabled:cursor-not-allowed disabled:opacity-40",
        )}
      >
        {loading === "audio" ? (
          // Minimal inline spinner — avoids importing Spinner for a tiny icon slot
          <span className="border-muted inline-block h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" />
        ) : (
          <Phone size={16} />
        )}
      </button>

      {/* Video call button */}
      <button
        onClick={() => handleCall("video")}
        disabled={isDisabled}
        title="Video call"
        aria-label="Start video call"
        className={cn(
          "text-muted hover:text-foreground hover:bg-surface-muted rounded-md p-1.5 transition-colors",
          "disabled:cursor-not-allowed disabled:opacity-40",
        )}
      >
        {loading === "video" ? (
          <span className="border-muted inline-block h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" />
        ) : (
          <Video size={16} />
        )}
      </button>
    </div>
  );
}
