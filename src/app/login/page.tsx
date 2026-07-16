"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui";
import { useSession } from "@/lib/auth";

const inputCls =
  "focus-ring w-full rounded-lg border border-edge bg-surface px-3.5 py-2.5 text-sm text-ink " +
  "placeholder:text-mut transition-shadow duration-200 focus:border-accent/50 " +
  "focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-accent)_12%,transparent)] outline-none";

export default function LoginPage() {
  const router = useRouter();
  const { session, signIn } = useSession();
  const [email, setEmail] = useState("");

  return (
    <AuthShell>
      <h1 className="font-display text-3xl tracking-tight text-ink">Welcome back</h1>
      <p className="mt-2 text-sm leading-relaxed text-sub">
        Sign in to your workspace — your agents, Rulebook, runs and baselines are where you left
        them.
      </p>

      <form
        className="mt-8 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          // V0: restore the local session, or start one for this email.
          if (!session || session.email !== email) {
            signIn({ name: email.split("@")[0], email });
          }
          router.push("/dashboard");
        }}
      >
        <input
          className={inputCls}
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Work email"
          autoComplete="email"
        />
        {/* Design-complete; V0 never stores or transmits this value. */}
        <input
          className={inputCls}
          type="password"
          required
          placeholder="Password"
          autoComplete="current-password"
        />
        <div className="flex items-center justify-between">
          <label className="flex cursor-pointer items-center gap-2 text-[13px] text-sub">
            <input type="checkbox" defaultChecked className="focus-ring size-3.5 accent-[#3ddc84]" />
            Keep me signed in
          </label>
          <span className="cursor-not-allowed text-[13px] text-mut" title="Arrives with the hosted beta">
            Forgot password?
          </span>
        </div>
        <Button type="submit" className="w-full">
          Sign in
        </Button>
      </form>

      <p className="mt-4 text-[12px] leading-relaxed text-mut">
        V0 preview: your session lives in this browser; no password is stored.
      </p>

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
