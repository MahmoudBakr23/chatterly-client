// ─── Root page — redirect ─────────────────────────────────────────────────────
// The root "/" route is not a real page — it just redirects.
// Middleware handles the auth check: if the user has a cookie they go to
// /conversations, if not they go to /login. But if someone lands on "/" directly
// without middleware catching it (shouldn't happen, but defensive), we redirect here.
//
// redirect() in a Server Component sends a 307 Temporary Redirect response —
// no page content is rendered, no JS shipped to the browser.

import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/conversations");
}
