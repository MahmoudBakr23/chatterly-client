// ─── /api/me Route Handler ────────────────────────────────────────────────────
// Called on app layout mount to rehydrate the auth store after a hard refresh.
//
// The problem this solves:
//   Zustand stores are in-memory — they reset on page refresh. After a refresh,
//   the browser still has the httpOnly auth cookie, but the Zustand store is empty.
//   This Route Handler reads the cookie (server-side only), forwards it to Rails as
//   an Authorization header, and returns the current user + token to the client
//   so the store can be repopulated.
//
// Flow on hard refresh:
//   Browser → GET /api/me (this file)
//           → GET http://localhost:3001/api/v1/users/me (Rails)
//           ← { user } (via UserBlueprint :with_email)
//   ← { user, token }  (token re-issued from the cookie for Zustand)

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const RAILS_API = process.env.API_URL ?? "http://localhost:3001";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  if (!token) {
    // No cookie = no session. Return 401 so the client knows to show login.
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Forward to Rails GET /api/v1/users/me.
  // This validates the JWT, checks it against JwtDenylist, and returns the user
  // via UserBlueprint :with_email (includes email + last_seen_at).
  const railsRes = await fetch(`${RAILS_API}/api/v1/users/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    // No caching — we always want the live user record on hydration.
    // A cached stale user could show wrong display_name after a profile update.
    cache: "no-store",
  });

  if (!railsRes.ok) {
    // Token expired or denylisted — clear the stale cookie and return 401.
    const store = await cookies();
    store.delete("auth_token");
    return NextResponse.json({ error: "Session expired" }, { status: 401 });
  }

  const body = await railsRes.json();
  const user = body.data ?? body;

  // Return both user and token. The client needs the token for Zustand so Axios
  // can attach it to direct API calls. We return it from the cookie value —
  // no need to re-issue; the existing token is still valid.
  return NextResponse.json({ user, token });
}
