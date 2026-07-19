"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthShell } from "@/components/auth-shell";
import { SsoButtons } from "@/components/sso-buttons";
import { Button } from "@/components/ui";
import { useSession } from "@/lib/auth";

const inputCls =
  "focus-ring w-full rounded-lg border border-edge bg-surface px-3.5 py-2.5 text-sm text-ink " +
  "placeholder:text-mut transition-shadow duration-200 focus:border-accent/50 " +
  "focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-accent)_12%,transparent)] outline-none";

export default function SignupPage() {
  const router = useRouter();
  const { signIn } = useSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");

  return (
    <AuthShell>
      <h1 className="font-display text-3xl tracking-tight text-ink">Create your workspace</h1>
      <p className="mt-2 text-sm leading-relaxed text-sub">
        First{" "}
        <span className="font-medium text-ink">250 simulations free</span>. No credit card
        required.
      </p>

      <div className="mt-8">
        <SsoButtons verb="Sign up" />
      </div>

      <form
        className="mt-6 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          signIn({ name, email, company: company || undefined });
          router.push("/setup");
        }}
      >
        <label className="block space-y-1.5">
          <span className="text-[13px] text-sub">Your name</span>
          <input
            className={inputCls}
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ada Lovelace"
            autoComplete="name"
          />
        </label>
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
          <span className="text-[13px] text-sub">Company · optional</span>
          <input
            className={inputCls}
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Acme Ltd"
            autoComplete="organization"
          />
        </label>
        {/* Design-complete; V0 never stores or transmits this value. */}
        <label className="block space-y-1.5">
          <span className="text-[13px] text-sub">Password — 8+ characters</span>
          <input
            className={inputCls}
            type="password"
            required
            minLength={8}
            placeholder="••••••••"
            autoComplete="new-password"
          />
        </label>
        <Button type="submit" className="w-full">
          Start simulating — free
        </Button>
      </form>

      <p className="mt-4 text-[12px] leading-relaxed text-mut">
        By signing up you agree to the terms of service. The 250 free simulations are granted once
        per person — alias emails and repeat sign-ups share the same allowance.
        <br />
        V0 preview: your session lives in this browser; no password is stored.
      </p>

      <p className="mt-8 border-t border-edge pt-5 text-[13px] text-sub">
        Already have a workspace?{" "}
        <Link href="/login" className="focus-ring rounded font-medium text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
