import { type NextRequest, NextResponse } from "next/server";

// ─── Edge Middleware — route protection ──────────────────────────────────────
// Next.js middleware runs at the edge (CDN level) before any page renders.
// Its role here mirrors Rails' before_action :authenticate_user! — it intercepts
// every request and redirects unauthenticated users away from protected routes.
//
// Why edge middleware instead of checking auth inside each page?
//   1. It runs before the page component — no flash of unauthenticated content
//   2. It's centralized — one place to update the auth routing logic
//   3. It runs on the CDN edge in production — no round trip to the origin server
//
// What it checks: the presence of the auth_token httpOnly cookie.
// It does NOT validate the JWT signature here (that would require crypto at the edge).
// Actual JWT validation happens server-side in the Route Handlers and inside the
// Rails API on every authenticated request. Middleware is the "bouncer at the door";
// the Rails API is the "ID check at the bar."

// Routes accessible without authentication
const PUBLIC_ROUTES = ["/login", "/register"];

// Routes that are always allowed through (Next.js internals, static files)
const IGNORED_PREFIXES = ["/_next", "/api", "/favicon.ico"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Let Next.js internals and static assets pass through unchecked.
  const isIgnored = IGNORED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (isIgnored) return NextResponse.next();

  const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));

  // The auth_token cookie is httpOnly — only server-side code can read its value.
  // Middleware runs server-side (at the edge), so we CAN check it here.
  // The browser itself cannot read this cookie, which is the entire XSS protection.
  const hasAuthCookie = request.cookies.has("auth_token");

  if (!isPublicRoute && !hasAuthCookie) {
    // Protected route, no session — redirect to login.
    // Preserve the intended destination so we can redirect back after login.
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isPublicRoute && hasAuthCookie) {
    // Already authenticated but trying to reach login/register — redirect to app.
    // Prevents the awkward state of being logged in and seeing the login form.
    return NextResponse.redirect(new URL("/conversations", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Matcher: run on everything except static assets and Next.js internals.
  // The negative lookahead (?!...) pattern excludes paths we don't need to protect.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
