"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// A dashboard menu pill that opens a small dropdown of related pages. Lime
// when any of its pages is open. The dropdown is positioned against the
// screen, so it isn't clipped by the menu's sideways scrolling on phones.
export function NavMenu({
  label,
  items,
}: {
  label: React.ReactNode;
  items: { href: string; label: string; exact?: boolean }[];
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const isActive = (item: { href: string; exact?: boolean }) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
  // The pill is lit on any page in its section (e.g. a single booking under Bookings).
  const active = items.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));

  // Close on a click elsewhere, Escape, or scrolling (and when a page is picked).
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== "Escape") return;
      if (e.type === "pointerdown" && (menuRef.current?.contains(e.target as Node) || buttonRef.current?.contains(e.target as Node))) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  function toggle() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) setPlace({ top: rect.bottom + 8, left: Math.min(rect.left, window.innerWidth - 232) });
    setOpen((o) => !o);
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold tracking-wider uppercase transition ${
          active ? "bg-lime text-brand-deep" : "text-white/75 hover:bg-white/10 hover:text-white"
        }`}
      >
        {label}
        <span className={`text-[10px] transition ${open ? "rotate-180" : ""}`} aria-hidden="true">
          ▾
        </span>
      </button>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          style={{ top: place.top, left: Math.max(8, place.left) }}
          className="fixed z-50 w-56 overflow-hidden rounded-2xl border border-border bg-surface p-1.5 text-foreground shadow-2xl"
        >
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              aria-current={isActive(item) ? "page" : undefined}
              className={`block rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${
                isActive(item) ? "bg-lime/20 text-lime-ink" : "hover:bg-background"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
