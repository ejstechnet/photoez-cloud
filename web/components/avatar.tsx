// Initials in a colored circle. The color is picked from the name, so each
// client keeps the same color every time.
const tints = [
  "bg-coral/20 ring-coral",
  "bg-sun/25 ring-sun",
  "bg-violet/20 ring-violet",
  "bg-pink/20 ring-pink",
  "bg-lime/20 ring-lime",
];

export function Avatar({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
  const hash = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0);

  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-full font-display font-bold text-foreground ring-2 ${
        tints[hash % tints.length]
      } ${size === "lg" ? "size-16 text-2xl" : "size-11 text-base"}`}
    >
      {initials || "?"}
    </span>
  );
}
