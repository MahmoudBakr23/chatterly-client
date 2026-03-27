"use client";

import { create } from "zustand";
import { disconnectCableConsumer } from "@/lib/actioncable";
import type { CurrentUser } from "@/types";

// ─── Auth store ──────────────────────────────────────────────────────────────
// Manages authentication state for the entire app.
// Zustand is chosen over Context+useReducer because:
//   1. No Provider wrapping needed — any component can subscribe directly
//   2. Stores survive component unmount (unlike local state or unstable contexts)
//   3. getState() works outside React (used by Axios interceptors in lib/axios.ts)
//
// What lives here vs. in the cookie:
//   - httpOnly cookie: the raw JWT string (server-readable only, XSS-safe)
//   - Zustand: the decoded user object + token string for client-side API calls
//
// On hard refresh the store resets. The app layout calls /api/me on mount to
// rehydrate from the httpOnly cookie — see app/(app)/layout.tsx.

interface AuthState {
  // The JWT string — set after login/register, cleared on logout or 401.
  // Used by lib/axios.ts interceptors to set Authorization headers.
  token: string | null;

  // The currently authenticated user. null = loading or unauthenticated.
  user: CurrentUser | null;

  // True while the layout is fetching /api/me on first mount.
  // Used to show a loading spinner instead of flashing the login page.
  isHydrating: boolean;

  // Actions
  setAuth: (token: string, user: CurrentUser) => void;
  setUser: (user: CurrentUser) => void;
  setHydrating: (value: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  token: null,
  user: null,
  isHydrating: true, // start true — assume we might have a session until /api/me confirms

  // setAuth is called after a successful login or register response.
  // The Route Handler (app/api/auth/login/route.ts) sets the httpOnly cookie and
  // returns { token, user } in the body — we store both here.
  setAuth: (token, user) => set({ token, user, isHydrating: false }),

  // setUser updates the user object without touching the token.
  // Used when /api/me returns a fresh user profile on hydration.
  setUser: (user) => set({ user, isHydrating: false }),

  // setHydrating controls the loading state during the /api/me fetch on mount.
  setHydrating: (value) => set({ isHydrating: value }),

  // logout clears all auth state and closes the WebSocket connection.
  // The Axios 401 interceptor (lib/axios.ts) also calls this for expired tokens.
  // Actual cookie deletion is handled by DELETE /api/auth/logout (Route Handler).
  logout: () => {
    // Close the WebSocket so the backend removes this client from all streams
    // and cleans up Redis presence keys immediately — not on next TTL expiry.
    disconnectCableConsumer();
    set({ token: null, user: null, isHydrating: false });
  },
}));

// ─── getAuthStore() ──────────────────────────────────────────────────────────
// Returns the store's current state outside React (used by Axios interceptors).
// Zustand stores expose getState() — this thin wrapper gives it a consistent name
// that's easy to grep for across the codebase.
export function getAuthStore(): AuthState {
  return useAuthStore.getState();
}
