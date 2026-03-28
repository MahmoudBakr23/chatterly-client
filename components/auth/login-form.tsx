"use client";

// ─── LoginForm component ──────────────────────────────────────────────────────
// Handles the login UI and submission flow. Client Component ("use client") because
// it uses hooks (useForm, useRouter) and handles user interaction.
//
// Form validation: Zod schema → @hookform/resolvers/zod → react-hook-form.
//   1. User submits → react-hook-form validates against the Zod schema client-side
//   2. If invalid → error messages render inline without a network call (fast feedback)
//   3. If valid → auth.service.login() → Next.js Route Handler → Rails API
//   4. On success → setAuth() on Zustand store → redirect to /conversations
//
// Connection to backend:
//   POST /api/auth/login (Route Handler) → POST /auth/sign_in (Rails Devise Sessions)
//   Response: { user: CurrentUser, token: string }

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "@/services/auth.service";
import { useAuthStore } from "@/store/auth.store";

// ─── Zod validation schema ────────────────────────────────────────────────────
// Validates before any network call. Mirrors the backend's Devise validations
// (email format, password minimum length) to give instant feedback.
const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuth = useAuthStore((state) => state.setAuth);

  // useTransition: marks the async redirect as a non-urgent update, preventing
  // React from blocking the UI while the router navigates. Also gives us isPending
  // to disable the submit button during the transition.
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: LoginFormValues) => {
    try {
      const { user, token } = await login(values.email, values.password);

      // Hydrate the Zustand store with the authenticated user and token.
      // From this point, Axios interceptors will attach the JWT to all API calls.
      setAuth(token, user);

      toast.success(`Welcome back, ${user.display_name}!`);

      // Redirect to the original destination if the middleware preserved it,
      // otherwise go to the default app landing page.
      const redirectTo = searchParams.get("redirect") ?? "/conversations";
      startTransition(() => router.push(redirectTo));
    } catch (error) {
      // Surface the error message from auth.service (already extracted from Rails response)
      toast.error(error instanceof Error ? error.message : "Something went wrong.");
    }
  };

  const isLoading = isSubmitting || isPending;

  return (
    <div className="border-border bg-surface rounded-lg border p-8 shadow-sm">
      <div className="mb-6">
        <h1 className="text-foreground text-xl font-semibold">Sign in</h1>
        <p className="text-muted mt-1 text-sm">Enter your credentials to continue.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {/* Email field */}
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            autoFocus
            disabled={isLoading}
            error={errors.email?.message}
            {...register("email")}
          />
        </div>

        {/* Password field */}
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            disabled={isLoading}
            error={errors.password?.message}
            {...register("password")}
          />
        </div>

        <Button type="submit" className="w-full" isLoading={isLoading}>
          Sign in
        </Button>
      </form>

      <p className="text-muted mt-6 text-center text-sm">
        No account?{" "}
        <Link href="/register" className="text-accent font-medium hover:underline">
          Create one
        </Link>
      </p>
    </div>
  );
}
