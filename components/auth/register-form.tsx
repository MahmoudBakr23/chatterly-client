"use client";

// ─── RegisterForm component ───────────────────────────────────────────────────
// Handles account creation. Same architectural pattern as LoginForm — see that
// file for the detailed flow commentary.
//
// Additional fields vs login:
//   - username: unique handle (used in @mentions, DM routing on backend)
//   - display_name: the human-readable name shown in conversation headers and avatars
//
// Connection to backend:
//   POST /api/auth/register → POST /auth/sign_up (Rails Devise Registrations)
//   Devise auto-signs-in the new user, returning the same { user, token } shape.

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { register as registerUser } from "@/services/auth.service";
import { useAuthStore } from "@/store/auth.store";

// ─── Zod schema ───────────────────────────────────────────────────────────────
// These rules mirror the backend model validations in User (Devise):
//   - email: uniqueness + format checked by Devise
//   - password: minimum 8 chars (Devise default)
//   - username: alphanumeric + underscore, 3-20 chars (backend validates this)
//   - display_name: just non-empty
const registerSchema = z
  .object({
    display_name: z
      .string()
      .min(1, "Display name is required")
      .max(50, "Display name must be 50 characters or less"),
    username: z
      .string()
      .min(3, "Username must be at least 3 characters")
      .max(20, "Username must be 20 characters or less")
      .regex(
        /^[a-z0-9_]+$/,
        "Username may only contain lowercase letters, numbers, and underscores",
      ),
    email: z.string().min(1, "Email is required").email("Enter a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    password_confirmation: z.string(),
  })
  .refine((data) => data.password === data.password_confirmation, {
    // Cross-field validation: confirm matches password — checked entirely client-side.
    // No need to send password_confirmation to the backend; Devise doesn't require it
    // when we supply password directly.
    message: "Passwords do not match",
    path: ["password_confirmation"],
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

export function RegisterForm() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      display_name: "",
      username: "",
      email: "",
      password: "",
      password_confirmation: "",
    },
  });

  const onSubmit = async (values: RegisterFormValues) => {
    try {
      const { user, token } = await registerUser(
        values.email,
        values.password,
        values.username,
        values.display_name,
      );

      setAuth(token, user);
      toast.success(`Welcome to Chatterly, ${user.display_name}!`);
      startTransition(() => router.push("/conversations"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong.");
    }
  };

  const isLoading = isSubmitting || isPending;

  return (
    <div className="border-border bg-surface rounded-lg border p-8 shadow-sm">
      <div className="mb-6">
        <h1 className="text-foreground text-xl font-semibold">Create an account</h1>
        <p className="text-muted mt-1 text-sm">Join Chatterly in seconds.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {/* Display name + username on one row (desktop) */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="display_name">Display name</Label>
            <Input
              id="display_name"
              placeholder="Mahmoud"
              autoComplete="name"
              autoFocus
              disabled={isLoading}
              error={errors.display_name?.message}
              {...register("display_name")}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              placeholder="mahmoud_b"
              autoComplete="username"
              disabled={isLoading}
              error={errors.username?.message}
              {...register("username")}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            disabled={isLoading}
            error={errors.email?.message}
            {...register("email")}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            autoComplete="new-password"
            disabled={isLoading}
            error={errors.password?.message}
            {...register("password")}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password_confirmation">Confirm password</Label>
          <Input
            id="password_confirmation"
            type="password"
            placeholder="••••••••"
            autoComplete="new-password"
            disabled={isLoading}
            error={errors.password_confirmation?.message}
            {...register("password_confirmation")}
          />
        </div>

        <Button type="submit" className="w-full" isLoading={isLoading}>
          Create account
        </Button>
      </form>

      <p className="text-muted mt-6 text-center text-sm">
        Already have an account?{" "}
        <Link href="/login" className="text-accent font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
