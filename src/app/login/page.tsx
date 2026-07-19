"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthShell } from "@/components/auth-shell";
import { SsoButtons } from "@/components/sso-buttons";
import { Button } from "@/components/ui";
import { useSession } from "@/lib/auth";
import { getSupabase, supabaseConfigured } from "@/lib/supabase";

const inputCls =
  "focus-ring w-full rounded-lg border border-edge bg-surface px-3.5 py-2.5 text-sm text-ink " +
  "placeholder:text-mut transition-shadow duration-200 focus:border-accent/50 " +
  "focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-accent)_12%,transparent)] outline-none";

export default function LoginPage() {
  const router = useRouter();
  const { session, signIn } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const supabase = getSupabase();
    if (!supabase) {
      // Preview mode: restore the local session, or start one for this email.
      if (!session || session.email !== email) {
        signIn({ name: email.split("@")[0], email });
      }
      router.push("/dashboard");
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) {
      setError(err.message);
      setBusy(false);
      return;
    }
    // The auth bridge mirrors the session into the workspace store.
    router.push("/dashboard");
  };

  return (
    <AuthShell>
      <h1 className="font-display text-3xl tracking-tight text-ink">Welcome back</h1>
      <p className="mt-2 text-sm leading-relaxed text-sub">
        Sign in to your workspace — your agents, Rulebook, runs and baselines are where you left
        them.
      </p>

      <div className="mt-8">
        <SsoButtons verb="Sign in" />
      </div>

      <form
        className="mt-6 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <label className="block space-y-1.5">
          <span className="text-[13px] text-sub">Work email</span>
          <input
            className={inputCls}
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            autoComplete="email"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-[13px] text-sub">Password</span>
          <input
            className={inputCls}
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </label>
        <div className="flex items-center justify-between">
          <label className="flex cursor-pointer items-center gap-2 text-[13px] text-sub">
            <input type="checkbox" defaultChecked className="focus-ring size-3.5 accent-accent" />
            Keep me signed in
          </label>
          <span className="cursor-not-allowed text-[13px] text-mut" title="Arrives with the hosted beta">
            Forgot password?
          </span>
        </div>
        {error && <p className="text-[13px] leading-relaxed text-fail">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      {!supabaseConfigured() && (
        <p className="mt-4 text-[12px] leading-relaxed text-mut">
          V0 preview: your session lives in this browser; no password is stored.
        </p>
      )}

      <p className="mt-8 border-t border-edge pt-5 text-[13px] text-sub">
        New to Preflight?{" "}
        <Link href="/signup" className="focus-ring rounded font-medium text-accent hover:underline">
          Create a workspace
        </Link>{" "}
        — first 250 simulations free.
      </p>
    </AuthShell>
  );
}
