// ─── Register page ────────────────────────────────────────────────────────────
// Server Component — sets metadata, renders the client-side RegisterForm.

import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = {
  title: "Create account",
};

export default function RegisterPage() {
  return <RegisterForm />;
}
