"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import formStyles from "@/components/auth-form.module.css";
import { AuthShell } from "@/components/auth-shell";
import { SsoButtons } from "@/components/sso-buttons";
import { Button } from "@/components/ui";
import { isSameSessionEmail, normalizeSessionEmail, useSession } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const { session, signIn, setSessionPersistence } = useSession();
  const [email, setEmail] = useState("");
  const [keepSignedIn, setKeepSignedIn] = useState(true);

  return (
    <AuthShell>
      <div className={formStyles.intro}>
        <p className={formStyles.routeLabel}>
          <span>01</span> Return to workspace
        </p>
        <h1>Welcome back.</h1>
        <p>
          Sign in to your workspace — your agents, Rulebook, runs and baselines are where you left
          them.
        </p>
      </div>

      <div className={formStyles.ssoBlock}>
        <SsoButtons verb="Sign in" />
      </div>

      <form
        className={formStyles.form}
        onSubmit={(event) => {
          event.preventDefault();
          const persistence = keepSignedIn ? "persistent" : "session";
          const normalizedEmail = normalizeSessionEmail(email);
          // V0: restore the browser session, or start one for this email.
          if (!session || !isSameSessionEmail(session.email, normalizedEmail)) {
            signIn(
              { name: normalizedEmail.split("@")[0], email: normalizedEmail },
              persistence,
            );
          } else {
            setSessionPersistence(persistence);
          }
          router.push("/dashboard");
        }}
      >
        <div className={formStyles.field}>
          <label htmlFor="login-email">Work email</label>
          <input
            id="login-email"
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
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            className={formStyles.input}
            type="password"
            required
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </div>

        <div className={formStyles.formMeta}>
          <label className={formStyles.sessionNote}>
            <input
              type="checkbox"
              checked={keepSignedIn}
              onChange={(event) => setKeepSignedIn(event.target.checked)}
            />
            <span className={formStyles.sessionCopy}>
              <strong>Keep me signed in</strong>
              <small>{keepSignedIn ? "Stored on this browser" : "This tab only"}</small>
            </span>
          </label>
          <span className={formStyles.unavailable}>Password recovery arrives with hosted auth</span>
        </div>

        <Button type="submit" className={formStyles.submit}>
          <span>Sign in to workspace</span>
          <span aria-hidden>→</span>
        </Button>
      </form>

      <p className={formStyles.alternate}>
        New to Preflight?{" "}
        <Link href="/signup">Create a workspace</Link> — first 250 simulations free.
      </p>
    </AuthShell>
  );
}
