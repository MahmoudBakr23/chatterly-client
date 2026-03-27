// ─── Logout Route Handler ─────────────────────────────────────────────────────
// Handles logout in two steps:
//   1. Calls Rails DELETE /auth/sign_out with the JWT — this adds the token to
//      the JwtDenylist table so it can't be reused even if someone captured it.
//   2. Clears the auth_token cookie from the browser.
//
// Why the denylist step matters:
//   JWTs are stateless — once issued, they're valid until they expire. Without the
//   denylist, a captured token would remain usable for up to 24 hours after logout.
//   The denylist converts logout into a hard invalidation, not just cookie deletion.

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const RAILS_API = process.env.API_URL ?? "http://localhost:3001";

export async function DELETE() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  if (token) {
    // Tell Rails to denylist the token. Fire-and-forget — if this fails (e.g. network
    // blip), we still clear the cookie. The token will expire naturally in 24h.
    // In a higher-security context you'd want to retry or queue this.
    try {
      await fetch(`${RAILS_API}/auth/sign_out`, {
        method: "DELETE",
        headers: {
          // Rails' authenticate_user! reads this header to identify and denylist the token.
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
    } catch {
      // Non-fatal — cookie will still be cleared
    }
  }

  // Delete the cookie regardless of whether the Rails call succeeded.
  // The browser will lose its session immediately.
  cookieStore.delete("auth_token");

  return NextResponse.json({ ok: true });
}
