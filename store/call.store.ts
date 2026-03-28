"use client";

// ─── Call store ───────────────────────────────────────────────────────────────
// Manages all WebRTC call state for the app.
//
// What lives here:
//   - incomingCall: a ringing call waiting for accept/decline (shown in IncomingCallModal)
//   - activeCallSessionId/conversationId/callType: the in-progress call
//   - localStream / remoteStreams: MediaStream objects for video/audio rendering
//   - isMuted / isCameraOff: our own media control state
//   - participantMuted / participantCameraOff: remote participant states
//     (broadcast via CallChannel toggle_mute / toggle_camera)
//
// Action Cable mutation flow:
//   CallChannel event → useCallChannel hook → store action → component re-render
//
// MediaStream note:
//   MediaStream objects are NOT serializable — this store must NOT use Zustand's
//   persist middleware. Storing streams in Zustand is fine as long as we don't
//   try to serialize/rehydrate them.
//
// Scalability notes:
//   remoteStreams is keyed by userId to support future group calls (mesh WebRTC).
//   For 1:1 calls there will only ever be one entry.

import { create } from "zustand";

// IncomingCallInfo — shape of the data we store when a ringing call arrives.
// Mirrors the incoming_call broadcast from call_channel.rb, minus the type tag.
export interface IncomingCallInfo {
  callSessionId: number;
  caller: { id: number; username: string; display_name: string };
  callType: "audio" | "video";
  conversationId: number;
}

interface CallState {
  // ─── Ringing state ────────────────────────────────────────────────────────
  // Set when an incoming_call event arrives, cleared on accept/decline.
  incomingCall: IncomingCallInfo | null;

  // ─── Active call state ─────────────────────────────────────────────────────
  activeCallSessionId: number | null;
  activeCallConversationId: number | null;
  callType: "audio" | "video" | null;

  // ─── Media streams ─────────────────────────────────────────────────────────
  // localStream: the browser camera/mic MediaStream (rendered in a muted <video>)
  // remoteStreams: keyed by userId — rendered in <video> elements per participant
  localStream: MediaStream | null;
  remoteStreams: Record<number, MediaStream>;

  // ─── Local controls ────────────────────────────────────────────────────────
  isMuted: boolean;
  isCameraOff: boolean;

  // ─── Remote participant states ─────────────────────────────────────────────
  // Updated by participant_muted / participant_camera_toggled CallChannel events
  participantMuted: Record<number, boolean>;
  participantCameraOff: Record<number, boolean>;

  // ─── Actions ───────────────────────────────────────────────────────────────
  setIncomingCall: (call: IncomingCallInfo | null) => void;
  setActiveCall: (sessionId: number, conversationId: number, callType: "audio" | "video") => void;
  // clearCall tears down all state — called on call_ended or hang-up
  clearCall: () => void;
  setLocalStream: (stream: MediaStream | null) => void;
  setRemoteStream: (userId: number, stream: MediaStream) => void;
  removeRemoteStream: (userId: number) => void;
  setMuted: (muted: boolean) => void;
  setCameraOff: (off: boolean) => void;
  setParticipantMuted: (userId: number, muted: boolean) => void;
  setParticipantCameraOff: (userId: number, off: boolean) => void;
}

export const useCallStore = create<CallState>()((set) => ({
  incomingCall: null,
  activeCallSessionId: null,
  activeCallConversationId: null,
  callType: null,
  localStream: null,
  remoteStreams: {},
  isMuted: false,
  isCameraOff: false,
  participantMuted: {},
  participantCameraOff: {},

  setIncomingCall: (call) => set({ incomingCall: call }),

  setActiveCall: (sessionId, conversationId, callType) =>
    set({
      activeCallSessionId: sessionId,
      activeCallConversationId: conversationId,
      callType,
      // Reset controls when a new call begins
      isMuted: false,
      isCameraOff: false,
      participantMuted: {},
      participantCameraOff: {},
    }),

  // clearCall resets everything back to idle — always stop MediaStream tracks
  // before calling this so the browser releases camera/microphone hardware.
  clearCall: () =>
    set({
      activeCallSessionId: null,
      activeCallConversationId: null,
      callType: null,
      localStream: null,
      remoteStreams: {},
      isMuted: false,
      isCameraOff: false,
      participantMuted: {},
      participantCameraOff: {},
    }),

  setLocalStream: (stream) => set({ localStream: stream }),

  setRemoteStream: (userId, stream) =>
    set((state) => ({
      remoteStreams: { ...state.remoteStreams, [userId]: stream },
    })),

  removeRemoteStream: (userId) =>
    set((state) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [userId]: _removed, ...rest } = state.remoteStreams;
      return { remoteStreams: rest };
    }),

  setMuted: (muted) => set({ isMuted: muted }),
  setCameraOff: (off) => set({ isCameraOff: off }),

  setParticipantMuted: (userId, muted) =>
    set((state) => ({
      participantMuted: { ...state.participantMuted, [userId]: muted },
    })),

  setParticipantCameraOff: (userId, off) =>
    set((state) => ({
      participantCameraOff: { ...state.participantCameraOff, [userId]: off },
    })),
}));
