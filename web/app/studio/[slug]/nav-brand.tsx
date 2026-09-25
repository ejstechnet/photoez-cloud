"use client";

import { useEffect, useState } from "react";

// The studio's small logo and name in the navigation bar. Hidden while the
// big header (#top) is on screen, so the brand never shows twice; fades in
// once the visitor scrolls past it.
export function NavBrand({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const header = document.getElementById("top");
    if (!header) return;
    // Count the header as gone once it has scrolled behind the sticky bar.
    const check = () => setVisible(header.getBoundingClientRect().bottom < 64);
    check();
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, []);

  return (
    <a
      href="#top"
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      className={`flex min-w-0 items-center gap-2.5 transition-opacity duration-300 ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      {children}
    </a>
  );
}
