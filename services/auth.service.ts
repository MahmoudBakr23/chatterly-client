// ─── Auth service ────────────────────────────────────────────────────────────
// All authentication API calls live here. Components and pages never call axios
// directly — they call these service functions. This isolates the API contract
// so that if the backend endpoint changes, only this file needs updating.
//
// These functions call our Next.js Route Handlers (app/api/auth/*/route.ts),
// NOT the Rails API directly. The Route Handlers act as a security proxy:
// they forward credentials to Rails, receive the JWT from the Authorization
// response header, and bake it into an httpOnly cookie before responding.
// The browser therefore never handles the raw JWT — the Route Handler does.

import type { CurrentUser } from "@/types";

// The shape the Route Handler returns on success.
// Both login and register return the same structure.
export interface AuthResponse {
  user: CurrentUser;
  // Token returned in the body too (alongside the httpOnly cookie) so the
  // Zustand store can hold it in memory for client-side Axios calls.
  token: string;
}

// ─── login() ─────────────────────────────────────────────────────────────────
// POST /api/auth/login → proxies to Rails POST /auth/sign_in (Devise Sessions)
// On success, the Route Handler sets the httpOnly auth_token cookie and returns
// { user, token }. We call setAuth() on the store with both values.
export async function login(email: string, password: string): Promise<AuthResponse> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // credentials: "include" ensures the browser sends and stores cookies
    // for same-origin requests. Required for the httpOnly cookie to be set.
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const error = await response.json();
    // Surface the backend's error message (Devise returns { error: "..." })
    throw new Error(error.error ?? "Login failed. Check your credentials and try again.");
  }

  return response.json() as Promise<AuthResponse>;
}

// ─── register() ──────────────────────────────────────────────────────────────
// POST /api/auth/register → proxies to Rails POST /auth/sign_up (Devise Registrations)
// On success, auto-logs in the user (same response shape as login).
export async function register(
  email: string,
  password: string,
  username: string,
  display_name: string,
): Promise<AuthResponse> {
  const response = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password, username, display_name }),
  });

  if (!response.ok) {
    const error = await response.json();
    // Devise registration errors come as { errors: { email: [...], ... } }
    const message =
      error.error ??
      (error.errors ? Object.values(error.errors).flat().join(", ") : "Registration failed.");
    throw new Error(message);
  }

  return response.json() as Promise<AuthResponse>;
}

// ─── logout() ────────────────────────────────────────────────────────────────
// DELETE /api/auth/logout → Route Handler reads cookie, calls Rails DELETE /auth/sign_out,
// then clears the cookie. Rails adds the JWT to JwtDenylist so it can't be reused
// even if someone captured the token before logout.
export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", {
    method: "DELETE",
    credentials: "include",
  });
  // Cookie cleared server-side. The store's logout() action is called by the
  // component triggering logout — not here, to keep the service layer pure (no store deps).
}

// ─── getMe() ─────────────────────────────────────────────────────────────────
// GET /api/me → Route Handler reads the httpOnly cookie and calls Rails GET /users/me.
// Called on app layout mount to rehydrate the auth store after a hard refresh.
// If the cookie is missing or the token is expired, returns null.
export async function getMe(): Promise<AuthResponse | null> {
  const response = await fetch("/api/me", {
    credentials: "include",
    // No-store cache: we always want the freshest user data on hydration,
    // not a stale cached version from a previous session.
    cache: "no-store",
  });

  if (!response.ok) return null;
  return response.json() as Promise<AuthResponse>;
}
