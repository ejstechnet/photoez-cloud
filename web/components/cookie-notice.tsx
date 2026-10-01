"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const KEY = "pez_cookie_notice";

// A small, dismissible note about cookies. PhotoEZ Cloud only uses cookies
// the service needs (login, referrals, Stripe's fraud checks), so this is a
// notice, not a consent prompt; add real consent before any analytics or ad
// pixel (e.g. Facebook's) is added.
export function CookieNotice() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read once after hydration
      setShow(!localStorage.getItem(KEY));
    } catch {
      setShow(false);
    }
  }, []);
  if (!show) return null;
  const dismiss = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {}
    setShow(false);
  };
  return (
    <div
      role="region"
      aria-label="Cookie notice"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-xl flex-col gap-3 rounded-2xl bg-brand-deep p-4 text-sm text-white shadow-2xl sm:flex-row sm:items-center"
    >
      <p className="flex-1">
        We only use cookies needed to keep you signed in and payments secure. No ads or tracking.{" "}
        <Link href="/privacy" className="font-semibold underline underline-offset-4 hover:text-lime">
          Privacy Policy
        </Link>
      </p>
      <button type="button" onClick={dismiss} className="btn-primary shrink-0 bg-lime text-brand-deep">
        OK
      </button>
    </div>
  );
}
