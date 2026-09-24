import Link from "next/link";
import { HeartIcon, ImagesIcon, SparklesIcon } from "./icons";

// The PhotoEZ mark: a photo frame (mountains and sun) with the lime swoosh
// arrow. The frame uses currentColor so it can be navy on light backgrounds
// and white on the navy header.
export function PhotoEZMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="60 30 205 175" className={className} aria-hidden="true">
      <rect x="88" y="46" width="119" height="131" fill="none" stroke="currentColor" strokeWidth="16" />
      <circle cx="146" cy="77" r="10" fill="currentColor" />
      <path
        d="M98 131 125 101l17 17 24-23 34 34"
        fill="none"
        stroke="currentColor"
        strokeWidth="9"
        strokeLinejoin="miter"
      />
      {/* Tapered swoosh: thin at the left, thick where it meets the arrowhead. */}
      <path d="M66 148C76 196 160 206 228 121L215 111C152 181 88 180 66 148Z" fill="var(--lime)" />
      <path d="M200 99 259 76 239 136Z" fill="var(--lime)" />
    </svg>
  );
}

// Logo lockup: mark + "Photo" + lime "EZ", with a CLOUD tag for this product.
export function Logo({ tone = "light" }: { tone?: "light" | "dark" }) {
  const ink = tone === "light" ? "text-white" : "text-brand dark:text-white";
  return (
    <Link href="/" className={`inline-flex items-center gap-2 ${ink}`} aria-label="PhotoEZ Cloud home">
      <PhotoEZMark className="h-11 w-12" />
      <span className="text-2xl font-extrabold tracking-tight">
        Photo<span className="text-lime">EZ</span>
      </span>
      <span className="rounded-md bg-sun px-1.5 py-0.5 text-[10px] font-extrabold tracking-widest text-brand-deep">
        CLOUD
      </span>
    </Link>
  );
}

// PhotoEZ's step-pill workflow, reimagined as the studio journey.
const steps = ["Inquiry", "Booked", "Proofing", "Delivered"];

export function WorkflowPills({ active = 2 }: { active?: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-2">
      {steps.map((step, i) => (
        <li key={step} className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold tracking-wider uppercase ${
              i === active ? "bg-lime text-brand-deep" : "bg-white/10 text-white/80 ring-1 ring-white/20"
            }`}
          >
            <span
              className={`grid size-5 place-items-center rounded-full text-[11px] ${
                i === active ? "bg-brand-deep text-lime" : "bg-white/15"
              }`}
            >
              {i + 1}
            </span>
            {step}
          </span>
          {i < steps.length - 1 && <span className="text-white/40">›</span>}
        </li>
      ))}
    </ol>
  );
}

// A playful stack of tilted "prints": decorative, not real photos.
const prints = [
  { position: "left-2 top-6 -rotate-8", tint: "from-coral to-sun", icon: <HeartIcon size={28} />, label: "Favorites" },
  { position: "right-4 top-0 rotate-6", tint: "from-violet to-pink", icon: <SparklesIcon size={28} />, label: "AI picks" },
  { position: "left-16 bottom-0 rotate-3", tint: "from-lime to-sun", icon: <ImagesIcon size={28} />, label: "Gallery" },
];

export function PrintStack({ className = "" }: { className?: string }) {
  return (
    <div className={`relative h-72 w-full max-w-sm ${className}`} aria-hidden="true">
      {prints.map((print) => (
        <div
          key={print.label}
          className={`absolute w-44 rounded-lg bg-white p-2.5 pb-8 shadow-2xl shadow-black/30 transition hover:z-10 hover:rotate-0 ${print.position}`}
        >
          <div
            className={`grid aspect-square place-items-center rounded bg-gradient-to-br text-brand-deep ${print.tint}`}
          >
            {print.icon}
          </div>
          <p className="absolute inset-x-0 bottom-2 text-center font-display text-sm italic text-brand-deep">
            {print.label}
          </p>
        </div>
      ))}
    </div>
  );
}
