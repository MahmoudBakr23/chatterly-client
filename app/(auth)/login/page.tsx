// ─── Login page ───────────────────────────────────────────────────────────────
// Server Component — sets metadata, renders the client-side LoginForm.
// Keeping the page itself as a Server Component means the metadata export works
// correctly and no unnecessary JS runs at the page level.

import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return <LoginForm />;
}
