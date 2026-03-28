"use client";

// ─── useCallChannel ────────────────────────────────────────────────────────────
// Subscribes to the Rails CallChannel (personal stream: "calls_user_<id>") and
// manages the WebRTC peer connection for audio/video calls.
//
// Backend connection:
//   Channel:  app/channels/call_channel.rb
//   Stream:   "calls_user_<currentUserId>" — each user has their own stream
//   Actions performed (client → server):
//     accept_call({ call_session_id })
//     decline_call({ call_session_id })
//     send_signal({ target_user_id, call_session_id, signal })
//     end_call({ call_session_id })
//     toggle_mute({ call_session_id, muted })
//     toggle_camera({ call_session_id, camera_off })
//
// Module-level singleton pattern:
//   _subscription and _peerConnection are module-level so that:
//   (a) Action functions (acceptCall, declineCall, etc.) can use them without
//       React context or prop-drilling.
//   (b) The received() handler in the subscription closure can access a mutable
//       reference to the peer connection as it evolves.
//   This follows the same pattern as lib/actioncable.ts (consumer singleton).
//
// WebRTC signaling flow (1:1 calls):
//   Initiator:  POST /calls → call_accepted event → create offer → send_signal
//   Recipient:  incoming_call event → user clicks Accept → acceptCall() →
//               receive signal(offer) → create answer → send_signal
//   Both:       ICE candidates exchanged via send_signal as they are collected
//
// Mount location: app/(app)/layout.tsx — once for the entire authenticated session.
// Do NOT mount per-conversation — one CallChannel subscription per tab.
//
// Scalability notes:
//   remoteStreams in the call store is keyed by userId to support future group
//   calls. Each additional participant would get their own RTCPeerConnection
//   (mesh topology). Phase 4 implements 1:1 only.

import { useEffect } from "react";
import { getCableConsumer } from "@/lib/actioncable";
import { useAuthStore } from "@/store/auth.store";
import { useCallStore } from "@/store/call.store";
import type { CallChannelEvent, WebRTCSignal } from "@/types";
import type { Subscription } from "@rails/actioncable";

// ICE servers — STUN for development (discovers public IP).
// In production, add TURN servers for peers behind symmetric NAT/firewalls.
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

// ─── Module-level singleton state ─────────────────────────────────────────────
// Not in React state — these are mutable browser objects that don't need to
// trigger re-renders. They live outside React's lifecycle.

let _subscription: Subscription | null = null;
let _peerConnection: RTCPeerConnection | null = null;
let _localStream: MediaStream | null = null;
// The user ID of the peer we're exchanging WebRTC signals with.
// Set on call_accepted (initiator) or on first signal (recipient).
let _remoteUserId: number | null = null;

// ─── Internal helpers ─────────────────────────────────────────────────────────

// createPeerConnection — builds an RTCPeerConnection wired to the call store.
// callSessionId is captured in the ICE handler closure to tag outgoing signals.
function createPeerConnection(callSessionId: number): RTCPeerConnection {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

  // Collect local ICE candidates and forward them to the remote peer via the
  // backend's send_signal relay. The backend doesn't inspect the signal —
  // it just forwards it to the target user's personal stream.
  pc.onicecandidate = (event) => {
    if (event.candidate && _remoteUserId && _subscription) {
      const signal: WebRTCSignal = {
        type: "ice_candidate",
        candidate: event.candidate.toJSON(),
      };
      _subscription.perform("send_signal", {
        target_user_id: _remoteUserId,
        call_session_id: callSessionId,
        signal,
      });
    }
  };

  // ontrack fires when the remote peer adds a media track.
  // We build a MediaStream from the arriving tracks and put it in the store
  // keyed by remoteUserId so <video> elements can subscribe.
  const remoteStream = new MediaStream();
  pc.ontrack = (event) => {
    event.streams[0]?.getTracks().forEach((track) => remoteStream.addTrack(track));
    if (_remoteUserId !== null) {
      useCallStore.getState().setRemoteStream(_remoteUserId, remoteStream);
    }
  };

  return pc;
}

// cleanupCall — stops all media tracks and tears down the peer connection.
// Always call this before clearCall() in the store so hardware is released.
function cleanupCall(): void {
  _peerConnection?.close();
  _peerConnection = null;

  _localStream?.getTracks().forEach((track) => track.stop());
  _localStream = null;

  _remoteUserId = null;
  useCallStore.getState().clearCall();
}

// ─── Public action functions ───────────────────────────────────────────────────
// Callable from any component — they use the module-level _subscription.
// Components should import these rather than calling subscription.perform() directly
// so the WebRTC side effects (media, peer connection) are always coordinated.

// acceptCall — called when the user clicks Accept on IncomingCallModal.
// Gets local media, creates the peer connection (ready to receive the offer),
// signals acceptance to the backend. The WebRTC offer will arrive shortly after
// as a signal event from the initiator.
export async function acceptCall(
  callSessionId: number,
  callType: "audio" | "video",
): Promise<void> {
  const { setLocalStream, incomingCall, setActiveCall, setIncomingCall } = useCallStore.getState();

  try {
    // Acquire camera/mic before signaling — if the browser denies permission,
    // we abort before telling the backend we accepted.
    const constraints = callType === "video" ? { audio: true, video: true } : { audio: true };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    _localStream = stream;
    setLocalStream(stream);

    // Create the peer connection now so ICE gathering can start.
    // We add tracks here — the offer will set the remote description shortly after.
    _peerConnection = createPeerConnection(callSessionId);
    stream.getTracks().forEach((track) => _peerConnection!.addTrack(track, stream));

    // Signal acceptance — backend broadcasts call_accepted to the initiator
    _subscription?.perform("accept_call", { call_session_id: callSessionId });

    // Transition to active call state
    if (incomingCall) {
      setActiveCall(callSessionId, incomingCall.conversationId, callType);
    }
    // Clear the ringing notification
    setIncomingCall(null);
  } catch (err) {
    // getUserMedia failure (permission denied, no device, etc.)
    console.error("[useCallChannel] acceptCall: media error:", err);
    cleanupCall();
  }
}

// declineCall — tells the backend to mark the session as declined.
export function declineCall(callSessionId: number): void {
  _subscription?.perform("decline_call", { call_session_id: callSessionId });
  useCallStore.getState().setIncomingCall(null);
}

// endCallAction — ends the call via WebSocket action (no REST needed here).
// The REST DELETE is used when the initiator hangs up before the call is answered;
// for mid-call hang-up, end_call via Action Cable is sufficient.
export function endCallAction(callSessionId: number): void {
  _subscription?.perform("end_call", { call_session_id: callSessionId });
  cleanupCall();
}

// toggleMuteAction — mutes/unmutes local audio and notifies other participants.
export function toggleMuteAction(callSessionId: number, muted: boolean): void {
  _localStream?.getAudioTracks().forEach((track) => {
    track.enabled = !muted;
  });
  useCallStore.getState().setMuted(muted);
  _subscription?.perform("toggle_mute", { call_session_id: callSessionId, muted });
}

// toggleCameraAction — turns local video on/off and notifies other participants.
export function toggleCameraAction(callSessionId: number, cameraOff: boolean): void {
  _localStream?.getVideoTracks().forEach((track) => {
    track.enabled = !cameraOff;
  });
  useCallStore.getState().setCameraOff(cameraOff);
  _subscription?.perform("toggle_camera", {
    call_session_id: callSessionId,
    camera_off: cameraOff,
  });
}

// ─── useCallChannel hook ───────────────────────────────────────────────────────
// Mount once in app/(app)/layout.tsx for the full authenticated session.

export function useCallChannel(): void {
  const token = useAuthStore((state) => state.token);
  const currentUserId = useAuthStore((state) => state.user?.id);
  const { setIncomingCall, setParticipantMuted, setParticipantCameraOff } = useCallStore();

  useEffect(() => {
    // Guard: only subscribe when authenticated
    if (!token || !currentUserId) return;

    const consumer = getCableConsumer(token);
    if (!consumer) return; // SSR guard

    const subscription = consumer.subscriptions.create(
      // CallChannel subscribes to "calls_user_<currentUserId>" — no channel params needed.
      // The backend derives the stream name from current_user.id in subscribed().
      { channel: "CallChannel" },
      {
        received(data: CallChannelEvent) {
          switch (data.type) {
            // ─── Incoming call ─────────────────────────────────────────────
            // A remote user started a call in a conversation we belong to.
            // Show the ringing modal — the user decides to accept or decline.
            case "incoming_call":
              setIncomingCall({
                callSessionId: data.call_session_id,
                caller: data.caller,
                callType: data.call_type,
                conversationId: data.conversation_id,
              });
              break;

            // ─── Call accepted (we are the initiator) ──────────────────────
            // Remote user accepted — we now create the WebRTC offer and send it.
            case "call_accepted": {
              const { activeCallSessionId, callType, setLocalStream } = useCallStore.getState();
              if (!activeCallSessionId || !callType) break;

              _remoteUserId = data.accepted_by.id;

              (async () => {
                try {
                  const constraints =
                    callType === "video" ? { audio: true, video: true } : { audio: true };
                  const stream = await navigator.mediaDevices.getUserMedia(constraints);
                  _localStream = stream;
                  setLocalStream(stream);

                  _peerConnection = createPeerConnection(activeCallSessionId);
                  stream.getTracks().forEach((track) => _peerConnection!.addTrack(track, stream));

                  // Manually create offer — onnegotiationneeded is not used here
                  // to keep the signaling flow explicit and easy to follow.
                  const offer = await _peerConnection.createOffer();
                  await _peerConnection.setLocalDescription(offer);

                  subscription.perform("send_signal", {
                    target_user_id: _remoteUserId,
                    call_session_id: activeCallSessionId,
                    signal: offer,
                  });
                  // Remote stream is set in the createPeerConnection ontrack handler
                } catch (err) {
                  console.error("[useCallChannel] call_accepted: offer error:", err);
                  cleanupCall();
                }
              })();
              break;
            }

            // ─── Call declined ─────────────────────────────────────────────
            case "call_declined":
              cleanupCall();
              break;

            // ─── WebRTC signal (offer / answer / ICE candidate) ────────────
            // Forwarded from the remote peer via the backend's send_signal relay.
            case "signal": {
              _remoteUserId = data.from_user_id;
              const { signal } = data;

              (async () => {
                try {
                  if ((signal as RTCSessionDescriptionInit).type === "offer") {
                    // Recipient receives offer — set remote desc, create answer.
                    // PC was created in acceptCall(), but create defensively if missing.
                    if (!_peerConnection) {
                      _peerConnection = createPeerConnection(data.call_session_id);
                      if (_localStream) {
                        _localStream
                          .getTracks()
                          .forEach((track) => _peerConnection!.addTrack(track, _localStream!));
                      }
                    }
                    await _peerConnection.setRemoteDescription(signal as RTCSessionDescriptionInit);
                    const answer = await _peerConnection.createAnswer();
                    await _peerConnection.setLocalDescription(answer);

                    subscription.perform("send_signal", {
                      target_user_id: data.from_user_id,
                      call_session_id: data.call_session_id,
                      signal: answer,
                    });
                  } else if ((signal as RTCSessionDescriptionInit).type === "answer") {
                    // Initiator receives answer — complete the handshake.
                    await _peerConnection?.setRemoteDescription(
                      signal as RTCSessionDescriptionInit,
                    );
                  } else if ((signal as { type: string }).type === "ice_candidate") {
                    // Both sides receive ICE candidates — add to the connection.
                    const { candidate } = signal as {
                      type: "ice_candidate";
                      candidate: RTCIceCandidateInit;
                    };
                    await _peerConnection?.addIceCandidate(new RTCIceCandidate(candidate));
                  }
                } catch (err) {
                  console.error("[useCallChannel] signal handling error:", err);
                }
              })();
              break;
            }

            // ─── Call ended by remote ──────────────────────────────────────
            case "call_ended":
              cleanupCall();
              break;

            // ─── Remote participant controls ───────────────────────────────
            case "participant_muted":
              setParticipantMuted(data.user_id, data.muted);
              break;

            case "participant_camera_toggled":
              setParticipantCameraOff(data.user_id, data.camera_off);
              break;
          }
        },
      },
    );

    _subscription = subscription;

    return () => {
      _subscription = null;
      subscription.unsubscribe();
    };
  }, [token, currentUserId]); // eslint-disable-line react-hooks/exhaustive-deps
}
