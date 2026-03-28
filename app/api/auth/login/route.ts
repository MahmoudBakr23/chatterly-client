// ─── Login Route Handler ──────────────────────────────────────────────────────
// This is a Next.js Route Handler — it runs SERVER-SIDE only, never in the browser.
// Its job: act as a secure proxy between the browser and the Rails API for login.
//
// Why not call Rails directly from the browser?
//   If we called Rails directly, the browser would receive the JWT in the response
//   body and we'd have to store it somewhere accessible to JavaScript.
//   localStorage is vulnerable to XSS. Memory is lost on refresh.
//   By routing through this handler, we can set an httpOnly cookie — which the
//   browser stores and automatically sends on every request, but JavaScript cannot
//   read or steal, even under XSS.
//
// Flow:
//   Browser → POST /api/auth/login (this file)
//           → POST http://localhost:3001/auth/sign_in (Rails Devise)
//           ← { user } + Authorization: Bearer <jwt>
//   ← Set-Cookie: auth_token=<jwt>; HttpOnly; SameSite=Lax
//   ← { user, token }  (token in body for in-memory Zustand store)

import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

// JWT lifetime must match devise-jwt config on the backend.
// If the cookie outlives the token, the user will be "logged in" but every API
// call will get a 401. Keeping them in sync prevents this confusion.
const JWT_MAX_AGE_SECONDS = 60 * 60 * 24; // 24 hours

const RAILS_API = process.env.API_URL ?? "http://localhost:3001";

export async function POST(request: NextRequest) {
  const { email, password } = await request.json();

  // Forward to Devise Sessions endpoint.
  // Devise expects: { user: { email, password } }
  const railsRes = await fetch(`${RAILS_API}/auth/sign_in`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user: { email, password } }),
  });

  if (!railsRes.ok) {
    const error = await railsRes.json();
    return NextResponse.json(error, { status: railsRes.status });
  }

  // Devise JWT returns the token in the Authorization response header, not the body.
  // This is the devise-jwt gem's default behavior — the body only contains the user.
  const authHeader = railsRes.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "").trim();

  if (!token) {
    return NextResponse.json(
      { error: "Authentication succeeded but no token was issued by the server." },
      { status: 500 },
    );
  }

  const user = await railsRes.json();

  // Set the httpOnly cookie. The browser will include this cookie on every subsequent
  // request to our Next.js server (including WebSocket upgrade for Action Cable).
  const cookieStore = await cookies();
  cookieStore.set("auth_token", token, {
    httpOnly: true, // JS cannot read it — XSS protection
    secure: process.env.NODE_ENV === "production", // HTTPS only in prod
    sameSite: "lax", // Sent on top-level navigations, not cross-site POSTs
    maxAge: JWT_MAX_AGE_SECONDS,
    path: "/", // Available site-wide
  });

  // Return user + token in the body. The client stores the token in Zustand memory
  // for attaching to direct API calls via Axios. On hard refresh, the token is lost
  // from memory but the cookie persists — the (app)/layout.tsx rehydrates on mount.
  return NextResponse.json({ user: user.data ?? user, token });
}
