"use client";

// ─── IncomingCallModal ────────────────────────────────────────────────────────
// Shown when an incoming_call event arrives on CallChannel.
// Renders a ringing overlay with caller identity, call type, and Accept/Decline.
//
// Backend connection:
//   Reads incomingCall from the call store — populated by useCallChannel when a
//   incoming_call broadcast arrives on "calls_user_<currentUserId>".
//   Accept → calls acceptCall() from useCallChannel (performs accept_call + WebRTC setup)
//   Decline → calls declineCall() from useCallChannel (performs decline_call)
//
// Mount location: app/(app)/layout.tsx — always mounted so it can appear over any page.
//
// Accessibility:
//   role="dialog" + aria-modal + focus trap would be ideal for production.
//   Kept minimal for Phase 4 — polish pass (Phase 5) can add full a11y.
//
// Scalability notes:
//   Only one incoming call is shown at a time. If multiple calls arrive in quick
//   succession, setIncomingCall overwrites the previous one. This is acceptable
//   for the current mesh-1:1 scope.

import { Phone, PhoneOff, Video } from "lucide-react";
import { useCallStore } from "@/store/call.store";
import { acceptCall, declineCall } from "@/hooks/useCallChannel";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useState } from "react";

export function IncomingCallModal() {
  const incomingCall = useCallStore((state) => state.incomingCall);
  const [accepting, setAccepting] = useState(false);

  // No incoming call — render nothing (not mounted in the tree)
  if (!incomingCall) return null;

  const { callSessionId, caller, callType } = incomingCall;

  async function handleAccept() {
    if (accepting) return;
    setAccepting(true);
    try {
      await acceptCall(callSessionId, callType);
    } finally {
      setAccepting(false);
    }
  }

  function handleDecline() {
    declineCall(callSessionId);
  }

  return (
    // Full-screen backdrop — sits above all other content
    <div
      className="fixed inset-0 z-50 flex items-end justify-center pb-8 sm:items-center sm:pb-0"
      role="dialog"
      aria-modal="true"
      aria-label={`Incoming ${callType} call from ${caller.display_name}`}
    >
      {/* Semi-transparent backdrop */}
      <div className="bg-background/70 absolute inset-0 backdrop-blur-sm" aria-hidden="true" />

      {/* Modal card */}
      <div className="bg-surface border-border relative z-10 flex w-80 flex-col items-center gap-5 rounded-2xl border p-6 shadow-2xl">
        {/* Call type indicator */}
        <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-full">
          {callType === "video" ? <Video size={20} /> : <Phone size={20} />}
        </div>

        {/* Caller info */}
        <div className="flex flex-col items-center gap-2 text-center">
          <UserAvatar user={{ ...caller, avatar_url: null }} size="lg" />
          <p className="text-foreground text-base font-semibold">{caller.display_name}</p>
          <p className="text-muted text-sm">
            Incoming {callType === "video" ? "video" : "audio"} call…
          </p>
        </div>

        {/* Accept / Decline */}
        <div className="flex w-full gap-3">
          {/* Decline */}
          <button
            onClick={handleDecline}
            className="bg-destructive/10 text-destructive hover:bg-destructive/20 flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium transition-colors"
            aria-label="Decline call"
          >
            <PhoneOff size={16} />
            Decline
          </button>

          {/* Accept */}
          <button
            onClick={handleAccept}
            disabled={accepting}
            className="bg-success/10 text-success hover:bg-success/20 flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium transition-colors disabled:opacity-50"
            aria-label="Accept call"
          >
            {accepting ? (
              <span className="border-success inline-block h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" />
            ) : (
              <Phone size={16} />
            )}
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
