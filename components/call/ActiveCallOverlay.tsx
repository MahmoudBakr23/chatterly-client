"use client";

// ─── ActiveCallOverlay ────────────────────────────────────────────────────────
// Full-screen overlay rendered while a call is active (activeCallSessionId set).
// Shows local + remote video streams and call control buttons.
//
// Backend connection:
//   - Reads stream state from the call store (populated by useCallChannel's ontrack handler)
//   - toggleMuteAction / toggleCameraAction → performs toggle_mute / toggle_camera on CallChannel
//   - endCallAction → performs end_call on CallChannel + REST DELETE if we are initiator
//
// Video rendering:
//   <video> elements receive MediaStream objects via the ref callback.
//   autoPlay + playsInline are required for mobile browsers.
//   The local video is muted to prevent audio feedback (we hear ourselves via speakers
//   without echo cancellation). Remote video is unmuted.
//
// Scalability notes:
//   remoteStreams is a Record<userId, MediaStream>. For 1:1 calls there is one entry.
//   For group calls (future), we map over all entries to render a video grid.
//   The grid uses CSS grid auto-fit — adding participants scales automatically.

import { useEffect, useRef } from "react";
import { MicOff, Mic, VideoOff, Video, PhoneOff } from "lucide-react";
import { useCallStore } from "@/store/call.store";
import { endCallAction, toggleMuteAction, toggleCameraAction } from "@/hooks/useCallChannel";
import { cn } from "@/lib/utils";

export function ActiveCallOverlay() {
  const {
    activeCallSessionId,
    callType,
    localStream,
    remoteStreams,
    isMuted,
    isCameraOff,
    participantMuted,
    participantCameraOff,
  } = useCallStore();

  // No active call — render nothing
  if (!activeCallSessionId) return null;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-gray-950" role="dialog" aria-modal="true">
      {/* ─── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3">
        <p className="text-sm font-medium text-white/70">
          {callType === "video" ? "Video call" : "Audio call"} · Active
        </p>
      </div>

      {/* ─── Video grid ──────────────────────────────────────────────────────── */}
      <div className="flex flex-1 items-center justify-center gap-4 p-4">
        {/* Remote participants */}
        {Object.entries(remoteStreams).map(([userId, stream]) => (
          <RemoteVideo
            key={userId}
            stream={stream}
            isMuted={participantMuted[Number(userId)] ?? false}
            isCameraOff={participantCameraOff[Number(userId)] ?? false}
          />
        ))}

        {/* Waiting state — no remote streams yet */}
        {Object.keys(remoteStreams).length === 0 && (
          <div className="flex flex-col items-center gap-3 text-white/50">
            <span className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />
            <p className="text-sm">Connecting…</p>
          </div>
        )}
      </div>

      {/* ─── Local video (picture-in-picture) ────────────────────────────────── */}
      {callType === "video" && localStream && (
        <LocalVideo stream={localStream} isCameraOff={isCameraOff} />
      )}

      {/* ─── Controls ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-4 pt-4 pb-8">
        {/* Mute toggle */}
        <ControlButton
          active={isMuted}
          activeLabel="Unmute"
          inactiveLabel="Mute"
          onClick={() => toggleMuteAction(activeCallSessionId, !isMuted)}
          activeIcon={<MicOff size={20} />}
          inactiveIcon={<Mic size={20} />}
        />

        {/* Camera toggle — only for video calls */}
        {callType === "video" && (
          <ControlButton
            active={isCameraOff}
            activeLabel="Turn camera on"
            inactiveLabel="Turn camera off"
            onClick={() => toggleCameraAction(activeCallSessionId, !isCameraOff)}
            activeIcon={<VideoOff size={20} />}
            inactiveIcon={<Video size={20} />}
          />
        )}

        {/* End call */}
        <button
          onClick={() => endCallAction(activeCallSessionId)}
          aria-label="End call"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500 text-white shadow-lg transition-colors hover:bg-red-600 active:scale-95"
        >
          <PhoneOff size={22} />
        </button>
      </div>
    </div>
  );
}

// ─── RemoteVideo ──────────────────────────────────────────────────────────────
// Renders one remote participant's video stream.
// Uses a ref callback to attach the MediaStream when the element mounts.

interface RemoteVideoProps {
  stream: MediaStream;
  isMuted: boolean;
  isCameraOff: boolean;
}

function RemoteVideo({ stream, isMuted, isCameraOff }: RemoteVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="relative aspect-video max-h-[60vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-gray-900">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className={cn("h-full w-full object-cover", isCameraOff && "hidden")}
      />
      {/* Camera-off placeholder */}
      {isCameraOff && (
        <div className="flex h-full w-full items-center justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-700">
            <VideoOff size={32} className="text-white/50" />
          </div>
        </div>
      )}
      {/* Mute indicator */}
      {isMuted && (
        <div className="absolute right-3 bottom-3 rounded-full bg-black/60 p-1.5">
          <MicOff size={14} className="text-white" />
        </div>
      )}
    </div>
  );
}

// ─── LocalVideo ───────────────────────────────────────────────────────────────
// Picture-in-picture preview of our own camera. Always muted to prevent feedback.

interface LocalVideoProps {
  stream: MediaStream;
  isCameraOff: boolean;
}

function LocalVideo({ stream, isCameraOff }: LocalVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="absolute right-4 bottom-28 h-32 w-24 overflow-hidden rounded-xl border border-white/10 bg-gray-900 shadow-lg sm:h-40 sm:w-28">
      {!isCameraOff ? (
        // muted — REQUIRED for local preview (prevents echo)
        <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <VideoOff size={20} className="text-white/40" />
        </div>
      )}
    </div>
  );
}

// ─── ControlButton ────────────────────────────────────────────────────────────
// Reusable toggle button for mute/camera controls.

interface ControlButtonProps {
  active: boolean;
  activeLabel: string;
  inactiveLabel: string;
  activeIcon: React.ReactNode;
  inactiveIcon: React.ReactNode;
  onClick: () => void;
}

function ControlButton({
  active,
  activeLabel,
  inactiveLabel,
  activeIcon,
  inactiveIcon,
  onClick,
}: ControlButtonProps) {
  return (
    <button
      onClick={onClick}
      aria-label={active ? activeLabel : inactiveLabel}
      className={cn(
        "flex h-12 w-12 items-center justify-center rounded-full transition-colors active:scale-95",
        active
          ? "bg-white/20 text-white hover:bg-white/30"
          : "bg-white/10 text-white/70 hover:bg-white/20",
      )}
    >
      {active ? activeIcon : inactiveIcon}
    </button>
  );
}
