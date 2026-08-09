"use client";

import { useState } from "react";

function GitHubIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" fill="currentColor" aria-hidden>
      <path d="M8 .5a7.5 7.5 0 00-2.37 14.62c.37.07.51-.16.51-.36l-.01-1.39c-2.09.45-2.53-.89-2.53-.89-.34-.86-.83-1.09-.83-1.09-.68-.47.05-.46.05-.46.75.05 1.15.77 1.15.77.67 1.15 1.76.82 2.19.63.07-.49.26-.82.48-1.01-1.67-.19-3.42-.83-3.42-3.7 0-.82.29-1.49.77-2.01-.08-.19-.33-.96.07-2 0 0 .63-.2 2.06.77a7.2 7.2 0 013.76 0c1.43-.97 2.06-.77 2.06-.77.4 1.04.15 1.81.07 2 .48.52.77 1.19.77 2.01 0 2.88-1.75 3.51-3.42 3.7.27.23.5.68.5 1.38l-.01 2.05c0 .2.14.43.52.36A7.5 7.5 0 008 .5z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 18 18" className="size-4" aria-hidden>
      <path
        fill="#4285F4"
        d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 01-1.797 2.716v2.258h2.909c1.702-1.567 2.684-3.875 2.684-6.614z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.91-2.259c-.806.54-1.835.859-3.046.859-2.344 0-4.328-1.585-5.037-3.714H.956v2.333A9 9 0 009 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.963 10.706A5.41 5.41 0 013.681 9c0-.592.102-1.168.282-1.706V4.961H.956A9 9 0 000 9c0 1.452.347 2.827.956 4.039l3.007-2.333z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.322 0 2.508.454 3.441 1.346l2.581-2.581C13.463.892 11.426 0 9 0A9 9 0 00.956 4.961l3.007 2.333C4.672 5.165 6.656 3.58 9 3.58z"
      />
    </svg>
  );
}

export function HeroAuthButtons() {
  const [message, setMessage] = useState(false);

  const showHostedBetaMessage = () => setMessage(true);

  return (
    <div className="mx-auto max-w-[26rem]">
      <div className="grid gap-2.5 sm:grid-cols-2">
        <button
          type="button"
          onClick={showHostedBetaMessage}
          className="focus-ring group flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-edge bg-surface/75 px-3 text-[12px] font-medium text-ink shadow-card backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-accent/30 hover:bg-raised sm:h-10"
        >
          <GitHubIcon />
          Continue with GitHub
        </button>
        <button
          type="button"
          onClick={showHostedBetaMessage}
          className="focus-ring group flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-edge bg-surface/75 px-3 text-[12px] font-medium text-ink shadow-card backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-accent/30 hover:bg-raised sm:h-10"
        >
          <GoogleIcon />
          Continue with Google
        </button>
      </div>
      <div className="mt-3 min-h-4 text-center text-[12px]" aria-live="polite">
        {message && (
          <p className="animate-fade-in text-warn">
            SSO lands with the hosted beta. Use Start free for now.
          </p>
        )}
      </div>
    </div>
  );
}
