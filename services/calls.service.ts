// ─── Calls service ────────────────────────────────────────────────────────────
// REST layer for call sessions.
//
// Backend endpoints (all scoped under a conversation):
//   POST   /api/v1/conversations/:id/calls         → initiate a call
//   DELETE /api/v1/conversations/:id/calls/:callId → end a call
//   GET    /api/v1/conversations/:id/calls/active  → fetch an active/ringing call
//
// Why REST for initiation?
//   The backend needs to persist the CallSession row and broadcast incoming_call
//   to all other conversation members via CallChannel. REST gives us a clean
//   request/response with the created CallSession (including its ID) which the
//   client stores to reference throughout the call lifecycle.
//
// Why REST for end?
//   Same reason — DELETE marks the session as ended in the DB and broadcasts
//   call_ended to all remaining participants.
//
// Scalability notes:
//   These are low-frequency calls (only on call start/end), so no caching needed.
//   getActiveCall() is only used on conversation mount to detect an ongoing call —
//   not polled repeatedly.

import axiosInstance from "@/lib/axios";
import type { CallSession, ApiSuccess } from "@/types";

// initiateCall — creates a CallSession and notifies remote participants via
// CallChannel. Returns the created session so the caller can track its ID.
export async function initiateCall(
  conversationId: number,
  callType: "audio" | "video",
): Promise<CallSession> {
  const { data } = await axiosInstance.post<ApiSuccess<CallSession>>(
    `/conversations/${conversationId}/calls`,
    { call: { call_type: callType } },
  );
  return data.data;
}

// endCall — marks the session as ended and broadcasts call_ended to participants.
// Called both by the initiator (hang up before answered) and mid-call by anyone.
export async function endCall(conversationId: number, callId: number): Promise<void> {
  await axiosInstance.delete(`/conversations/${conversationId}/calls/${callId}`);
}

// getActiveCall — fetches a ringing or active call for a conversation.
// Returns null if no such call exists (404 from backend → null here).
// Used on conversation mount to show an in-progress call banner.
export async function getActiveCall(conversationId: number): Promise<CallSession | null> {
  try {
    const { data } = await axiosInstance.get<ApiSuccess<CallSession>>(
      `/conversations/${conversationId}/calls/active`,
    );
    return data.data;
  } catch {
    // 404 = no active call — not an error worth surfacing
    return null;
  }
}
