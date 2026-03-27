// ─── Register Route Handler ───────────────────────────────────────────────────
// Same proxy pattern as login/route.ts — see that file for the full security rationale.
// Proxies to Rails POST /auth/sign_up (Devise Registrations controller).
// On success, Devise auto-signs-in the new user and returns a JWT — same response
// shape as login, so the client handles both identically.

import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

const JWT_MAX_AGE_SECONDS = 60 * 60 * 24;
const RAILS_API = process.env.API_URL ?? "http://localhost:3001";

export async function POST(request: NextRequest) {
  const { email, password, username, display_name } = await request.json();

  // Devise Registrations expects: { user: { email, password, username, display_name } }
  // The field names must match the permitted params in the Devise registration controller.
  const railsRes = await fetch(`${RAILS_API}/auth/sign_up`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user: { email, password, username, display_name } }),
  });

  if (!railsRes.ok) {
    const error = await railsRes.json();
    // Devise registration errors: { errors: { email: ["has already been taken"], ... } }
    return NextResponse.json(error, { status: railsRes.status });
  }

  const authHeader = railsRes.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "").trim();

  if (!token) {
    return NextResponse.json(
      { error: "Registration succeeded but no token was issued by the server." },
      { status: 500 },
    );
  }

  const user = await railsRes.json();

  const cookieStore = await cookies();
  cookieStore.set("auth_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: JWT_MAX_AGE_SECONDS,
    path: "/",
  });

  return NextResponse.json({ user: user.data ?? user, token });
}
