// ─── Auth layout ─────────────────────────────────────────────────────────────
// Route group: (auth) — wraps /login and /register.
// Route groups (parentheses in folder name) affect layout nesting but NOT the URL.
// /login renders as "/login", not "/(auth)/login".
//
// This layout centers its children in the viewport — the classic auth card pattern.
// It's deliberately minimal: no navigation, no sidebar, just the form.
// Clean context = reduced cognitive load during the critical onboarding moment.

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      // Full viewport height, centered both axes.
      // bg-surface-muted gives a very subtle off-white that makes the white
      // auth card appear to "float" without a heavy shadow.
      className="flex min-h-screen items-center justify-center bg-surface-muted px-4"
    >
      <div className="w-full max-w-sm">
        {/* Chatterly wordmark — kept minimal, no heavy logo */}
        <div className="mb-8 text-center">
          <span className="text-2xl font-semibold tracking-tight text-foreground">
            Chatterly
          </span>
        </div>

        {children}
      </div>
    </div>
  );
}
