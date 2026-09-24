import Link from "next/link";
import { HeartIcon, ImagesIcon, SparklesIcon } from "./icons";

// The PhotoEZ Cloud mark: the PhotoEZ photo frame (mountains and sun) and
// lime swoosh arrow, in front of a sky-blue cloud. Vector, so it stays crisp
// at any size; same artwork as app/icon.svg.
export function PhotoEZCloudMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="10 20 300 210" className={className} aria-hidden="true">
      <path
        d="M70 205C33 205 18 168 42 146C26 112 60 84 96 94C108 44 176 30 206 76C238 58 278 80 272 116C302 132 296 205 256 205Z"
        fill="var(--sky-light)"
        stroke="var(--sky)"
        strokeWidth="9"
        strokeLinejoin="round"
      />
      <rect x="100" y="56" width="106" height="112" fill="#fff" stroke="var(--brand)" strokeWidth="13" />
      <circle cx="152" cy="87" r="10" fill="var(--brand)" />
      <path d="M110 144 133 114l15 15 21-21 28 30" fill="none" stroke="var(--brand)" strokeWidth="8.5" />
      {/* Tapered swoosh: thin at the left, thick where it meets the arrowhead. */}
      <path d="M72 160C82 214 196 208 262 112L248 102C188 184 98 190 72 160Z" fill="var(--lime)" stroke="#fff" strokeWidth="3" />
      <path d="M232 88 300 58 276 132Z" fill="var(--lime)" stroke="#fff" strokeWidth="3" strokeLinejoin="round" />
    </svg>
  );
}

// Logo lockup, matching the PhotoEZ Cloud logo: mark, "Photo" + lime "EZ",
// and CLOUD in spaced capitals between two rules.
export function Logo({ tone = "light" }: { tone?: "light" | "dark" }) {
  const ink = tone === "light" ? "text-white" : "text-brand dark:text-white";
  const cloud = tone === "light" ? "text-sky-light" : "text-sky";
  return (
    <Link href="/" className={`inline-flex items-center gap-2.5 ${ink}`} aria-label="PhotoEZ Cloud home">
      <PhotoEZCloudMark className="h-11 w-16" />
      <span className="flex flex-col leading-none">
        <span className="text-2xl font-extrabold tracking-tight">
          Photo<span className="text-lime">EZ</span>
        </span>
        <span className={`mt-1 flex items-center gap-1.5 text-[10px] font-bold tracking-[0.35em] ${cloud}`}>
          <span className="h-px flex-1 bg-current" />
          CLOUD
          <span className="h-px flex-1 bg-current" />
        </span>
      </span>
    </Link>
  );
}

// PhotoEZ's step-pill workflow. The home page shows the studio journey; the
// client gallery shows the proofing steps.
export const STUDIO_STEPS = ["Inquiry", "Booked", "Proofing", "Delivered"];
export const GALLERY_STEPS = ["Proof gallery", "Submitted", "Awaiting finals", "Final delivery"];

export function WorkflowPills({ active = 2, steps = STUDIO_STEPS }: { active?: number; steps?: string[] }) {
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
