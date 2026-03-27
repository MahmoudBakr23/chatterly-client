import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";

// ─── Axios instance ──────────────────────────────────────────────────────────
// We create a single configured instance rather than using the global axios object.
// This centralises base URL, headers, and interceptors in one place — every API
// call in `services/` imports this instance, so a config change here propagates
// everywhere with no hunt-and-replace.
//
// Backend connection: all requests target chatterly-api running on API_URL.
// The API is versioned under /api/v1 and authenticated via Devise JWT.
//
// Why no NEXT_PUBLIC_ prefix on API_URL?
//   API_URL is server-only. The Axios instance is used client-side, but the URL
//   it reads is the public backend URL (not an internal address). We keep it as
//   NEXT_PUBLIC_API_URL so the browser can use it directly.
//   The internal API_URL (without NEXT_PUBLIC_) is only used in Route Handlers.

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001",
  headers: {
    "Content-Type": "application/json",
    // Tell the backend we accept JSON — Rails checks Accept header to decide
    // whether to render JSON or HTML (API-only mode always returns JSON anyway,
    // but being explicit is clearer and avoids any edge-case double-render).
    Accept: "application/json",
  },
  // 15 second timeout — long enough for slow connections, short enough to fail
  // fast instead of hanging. Adjust per endpoint in Phase 5 (file uploads).
  timeout: 15_000,
});

// ─── Request interceptor: inject JWT ─────────────────────────────────────────
// Every outgoing request automatically gets the Authorization header from
// the in-memory auth store. We read the store's getState() directly here
// (no hook) because interceptors run outside React's component tree.
//
// Why in-memory instead of reading the cookie?
//   The auth cookie is httpOnly — JavaScript cannot read it. Only server-side
//   code (Route Handlers, middleware) can. So the browser holds the token in
//   Zustand memory and loses it on hard refresh. On refresh, the app calls
//   /api/me (which reads the httpOnly cookie server-side) to rehydrate the store.
//
// This is a deliberate security trade-off: httpOnly cookie protects against XSS
// token theft; in-memory store is the bridge for client-side API calls.
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  // Lazy import avoids circular dependency (store imports api, api imports store).
  // getState() is synchronous and safe to call outside React — Zustand supports this.
  const { getAuthStore } = require("@/store/auth.store") as typeof import("@/store/auth.store");
  const token = getAuthStore().token;

  if (token) {
    // Devise JWT expects "Bearer <token>" in the Authorization header.
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// ─── Response interceptor: handle 401 globally ───────────────────────────────
// When the backend returns 401 (expired or revoked token), we clear the auth
// state and redirect to login — no individual service needs to handle this.
// This mirrors Rails' before_action :authenticate_user! which returns 401
// automatically when the JWT is missing or invalid.
api.interceptors.response.use(
  // Success path: pass through untouched
  (response) => response,

  // Error path: inspect status and handle globally where possible
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Import dynamically to avoid circular deps (same pattern as above).
      const { getAuthStore } =
        require("@/store/auth.store") as typeof import("@/store/auth.store");
      getAuthStore().logout();
      // Redirect to login. We use window.location rather than Next.js router
      // because this interceptor runs outside the React component tree.
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }

    // Re-throw so individual service callers can still catch and display
    // specific error messages (e.g. validation errors on 422).
    return Promise.reject(error);
  },
);

export default api;
