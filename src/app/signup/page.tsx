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

function SsoButton({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="focus-ring flex h-10 flex-1 cursor-pointer items-center justify-center gap-2.5 rounded-lg border border-edge text-[13px] font-medium text-ink transition-colors hover:border-mut hover:bg-raised"
    >
      {icon}
      {label}
    </button>
  );
}

const googleIcon = (
  <svg viewBox="0 0 16 16" className="size-4" aria-hidden>
    <path
      fill="currentColor"
      d="M15.5 8.18c0-.57-.05-1.11-.15-1.63H8v3.09h4.2a3.6 3.6 0 01-1.56 2.36v1.96h2.53c1.48-1.36 2.33-3.37 2.33-5.78z"
      opacity=".9"
    />
    <path
      fill="currentColor"
      d="M8 15.5c2.11 0 3.88-.7 5.17-1.9l-2.53-1.95c-.7.47-1.6.74-2.64.74-2.03 0-3.75-1.37-4.36-3.21H1.03v2.02A7.5 7.5 0 008 15.5z"
      opacity=".7"
    />
    <path
      fill="currentColor"
      d="M3.64 9.18a4.5 4.5 0 010-2.86V4.3H1.03a7.5 7.5 0 000 6.9l2.6-2.02z"
      opacity=".5"
    />
    <path
      fill="currentColor"
      d="M8 3.61c1.15 0 2.18.4 2.99 1.17l2.24-2.24A7.48 7.48 0 008 .5 7.5 7.5 0 001.03 4.8l2.6 2.02C4.25 4.98 5.97 3.61 8 3.61z"
      opacity=".85"
    />
  </svg>
);

const githubIcon = (
  <svg viewBox="0 0 16 16" className="size-4" fill="currentColor" aria-hidden>
    <path d="M8 .5a7.5 7.5 0 00-2.37 14.62c.37.07.51-.16.51-.36l-.01-1.39c-2.09.45-2.53-.89-2.53-.89-.34-.86-.83-1.09-.83-1.09-.68-.47.05-.46.05-.46.75.05 1.15.77 1.15.77.67 1.15 1.76.82 2.19.63.07-.49.26-.82.48-1.01-1.67-.19-3.42-.83-3.42-3.7 0-.82.29-1.49.77-2.01-.08-.19-.33-.96.07-2 0 0 .63-.2 2.06.77a7.2 7.2 0 013.76 0c1.43-.97 2.06-.77 2.06-.77.4 1.04.15 1.81.07 2 .48.52.77 1.19.77 2.01 0 2.88-1.75 3.51-3.42 3.7.27.23.5.68.5 1.38l-.01 2.05c0 .2.14.43.52.36A7.5 7.5 0 008 .5z" />
  </svg>
);

export default function SignupPage() {
  const router = useRouter();
  const { signIn } = useSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [ssoNote, setSsoNote] = useState(false);

  const sso = () => setSsoNote(true);

  return (
    <AuthShell>
      <h1 className="font-display text-3xl tracking-tight text-ink">Create your workspace</h1>
      <p className="mt-2 text-sm leading-relaxed text-sub">
        First{" "}
        <span className="font-medium text-ink">250 simulations free</span>. No credit card
        required.
      </p>

      <div className="mt-8 flex gap-3">
        <SsoButton label="Google" icon={googleIcon} onClick={sso} />
        <SsoButton label="GitHub" icon={githubIcon} onClick={sso} />
      </div>
      {ssoNote && (
        <p className="mt-2 text-[12px] text-warn">
          SSO lands with the hosted beta — use email below for now.
        </p>
      )}

      <div className="mt-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-edge" />
        <span className="font-mono text-[10px] tracking-[0.14em] text-mut">OR</span>
        <span className="h-px flex-1 bg-edge" />
      </div>

      <form
        className="mt-6 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          signIn({ name, email, company: company || undefined });
          router.push("/setup");
        }}
      >
        <input
          className={inputCls}
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          autoComplete="name"
        />
        <input
          className={inputCls}
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Work email"
          autoComplete="email"
        />
        <input
          className={inputCls}
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="Company · optional"
          autoComplete="organization"
        />
        {/* Design-complete; V0 never stores or transmits this value. */}
        <input
          className={inputCls}
          type="password"
          required
          minLength={8}
          placeholder="Password — 8+ characters"
          autoComplete="new-password"
        />
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
