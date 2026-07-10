import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff, Lock, Mail, Shield } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Fawri Lifestyle" },
      { name: "description", content: "Sign in to Fawri Lifestyle production." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [showPw, setShowPw] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // UI-only for now. Wire up auth later.
    navigate({ to: "/" });
  }

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-2">
      {/* Brand panel */}
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-primary via-primary to-primary-glow p-10 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-white/10 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15 text-lg font-black backdrop-blur">
            F
          </div>
          <div className="leading-tight">
            <div className="text-base font-extrabold tracking-tight">Fawri Lifestyle</div>
            <div className="text-xs opacity-80">Production Suite</div>
          </div>
        </div>

        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-widest opacity-80">
            Garment Production
          </p>
          <h2 className="mt-3 text-4xl font-extrabold leading-tight tracking-tight">
            From first sample<br />to ready stock.
          </h2>
          <p className="mt-4 max-w-sm text-sm opacity-90">
            One simple workflow for your factory floor. Track every piece across all 12
            stages of production.
          </p>
        </div>

        <div className="relative flex items-center gap-2 text-xs opacity-80">
          <Shield className="h-4 w-4" />
          Secure access for factory teams
        </div>
      </aside>

      {/* Form panel */}
      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-md">
          {/* Mobile brand */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-primary to-primary-glow text-base font-black text-primary-foreground shadow-md">
              F
            </div>
            <div className="leading-tight">
              <div className="text-sm font-extrabold tracking-tight">Fawri Lifestyle</div>
              <div className="text-[11px] text-muted-foreground">Production</div>
            </div>
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight">Welcome back</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to continue to your production dashboard.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <label htmlFor="email" className="text-sm font-semibold text-foreground">
                Email
              </label>
              <div className="relative mt-1.5">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@fawri.co"
                  className="h-14 w-full rounded-2xl border border-input bg-card pl-11 pr-4 text-base font-medium text-foreground shadow-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-4 focus:ring-primary/15"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-sm font-semibold text-foreground">
                  Password
                </label>
                <button
                  type="button"
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Forgot?
                </button>
              </div>
              <div className="relative mt-1.5">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="password"
                  type={showPw ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-14 w-full rounded-2xl border border-input bg-card pl-11 pr-12 text-base font-medium text-foreground shadow-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-4 focus:ring-primary/15"
                />
                <button
                  type="button"
                  aria-label={showPw ? "Hide password" : "Show password"}
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-xl text-muted-foreground hover:bg-accent"
                >
                  {showPw ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2 pt-1 text-sm text-muted-foreground">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-input text-primary accent-[oklch(0.62_0.22_293)]"
              />
              Keep me signed in on this device
            </label>

            <button
              type="submit"
              className="mt-2 h-14 w-full rounded-2xl bg-gradient-to-r from-primary to-primary-glow text-base font-bold text-primary-foreground shadow-lg shadow-primary/30 transition hover:brightness-105 active:scale-[0.99]"
            >
              Sign in
            </button>

            <p className="pt-2 text-center text-sm text-muted-foreground">
              Need an account?{" "}
              <Link to="/" className="font-semibold text-primary hover:underline">
                Contact your supervisor
              </Link>
            </p>
          </form>
        </div>
      </section>
    </div>
  );
}
