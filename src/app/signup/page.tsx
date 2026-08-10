"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import formStyles from "@/components/auth-form.module.css";
import { AuthShell } from "@/components/auth-shell";
import { SsoButtons } from "@/components/sso-buttons";
import { Button } from "@/components/ui";
import { useSession } from "@/lib/auth";
import { useMode } from "@/lib/mode";

export default function SignupPage() {
  const router = useRouter();
  const { signIn } = useSession();
  const { setMode } = useMode();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");

  return (
    <AuthShell>
      <div className={formStyles.intro}>
        <p className={formStyles.routeLabel}>
          <span>01</span> New workspace
        </p>
        <h1>Create your workspace.</h1>
        <p>
          Start with <strong>250 simulations free</strong>. No credit card required.
        </p>
        <div className={formStyles.assurances} aria-label="Signup benefits">
          <span>250 simulations</span>
          <span>No credit card</span>
        </div>
      </div>

      <div className={formStyles.ssoBlock}>
        <SsoButtons verb="Sign up" />
      </div>

      <form
        className={formStyles.form}
        onSubmit={(event) => {
          event.preventDefault();
          setMode("live");
          signIn({ name, email, company: company || undefined });
          router.push("/setup");
        }}
      >
        <div className={formStyles.field}>
          <label htmlFor="signup-name">Your name</label>
          <input
            id="signup-name"
            className={formStyles.input}
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ada Lovelace"
            autoComplete="name"
          />
        </div>

        <div className={formStyles.field}>
          <label htmlFor="signup-email">Work email</label>
          <input
            id="signup-email"
            className={formStyles.input}
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@company.com"
            autoComplete="email"
          />
        </div>

        <div className={formStyles.field}>
          <label htmlFor="signup-company">
            Company <span>· optional</span>
          </label>
          <input
            id="signup-company"
            className={formStyles.input}
            value={company}
            onChange={(event) => setCompany(event.target.value)}
            placeholder="Acme Ltd"
            autoComplete="organization"
          />
        </div>

        <div className={formStyles.field}>
          <label htmlFor="signup-password">
            Password <span>· 8+ characters</span>
          </label>
          <input
            id="signup-password"
            className={formStyles.input}
            type="password"
            required
            minLength={8}
            placeholder="••••••••"
            autoComplete="new-password"
          />
        </div>

        <Button type="submit" className={formStyles.submit}>
          <span>Start simulating for free</span>
          <span aria-hidden>→</span>
        </Button>
      </form>

      <p className={formStyles.legal}>
        By signing up you agree to the terms of service. The 250 free simulations are enforced per
        email and device; repeat sign-ups do not reset the allowance.
      </p>

      <p className={formStyles.alternate}>
        Already have a workspace? <Link href="/login">Sign in</Link>
      </p>
    </AuthShell>
  );
}
