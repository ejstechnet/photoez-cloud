// Illustrated "screenshots" for the home page, drawn in code: crisp on every
// screen, no real client photos, and they never go out of date.

// Colorful stand-ins for photos.
const PHOTO_TONES = [
  "from-coral to-sun",
  "from-sky to-violet",
  "from-lime to-sky",
  "from-violet to-pink",
  "from-sun to-coral",
  "from-brand to-sky",
  "from-pink to-sun",
  "from-lime-ink to-lime",
];

function Photo({ i, className = "" }: { i: number; className?: string }) {
  return <div className={`bg-gradient-to-br ${PHOTO_TONES[i % PHOTO_TONES.length]} ${className}`} />;
}

// PhotoEZ for WordPress: a WordPress admin screen with the PhotoEZ dashboard.
export function WordPressMockup() {
  const cards = [
    { label: "Total galleries", value: "24", bar: "border-b-coral" },
    { label: "Pending", value: "3", bar: "border-b-sky" },
    { label: "Delivered", value: "19", bar: "border-b-lime" },
    { label: "Booking revenue", value: "$4,850", bar: "border-b-violet" },
  ];
  const menu = ["Dashboard", "Posts", "Media", "Pages", "PhotoEZ", "Bookings", "Contracts", "Reviews", "Settings"];
  return (
    <div
      className="overflow-hidden rounded-2xl border border-border bg-white shadow-2xl"
      role="img"
      aria-label="The PhotoEZ dashboard inside WordPress"
    >
      {/* Browser bar */}
      <div className="flex items-center gap-1.5 border-b border-border bg-[#f0f0f1] px-3 py-2" aria-hidden="true">
        <span className="size-2.5 rounded-full bg-coral" />
        <span className="size-2.5 rounded-full bg-sun" />
        <span className="size-2.5 rounded-full bg-lime" />
        <span className="ml-3 h-4 flex-1 rounded bg-white px-2 text-[9px] leading-4 text-muted">yourstudio.com/wp-admin</span>
      </div>
      <div className="flex" aria-hidden="true">
        {/* WordPress sidebar */}
        <div className="w-28 shrink-0 bg-[#1d2327] py-2 sm:w-32">
          <div className="mb-2 flex items-center gap-1.5 px-3">
            <span className="grid size-5 place-items-center rounded-full border border-white/70 font-serif text-[10px] font-bold text-white">
              W
            </span>
            <span className="h-1.5 w-10 rounded-full bg-white/40" />
          </div>
          {menu.map((item) => (
            <div
              key={item}
              className={`px-3 py-1.5 text-[10px] ${
                item === "PhotoEZ" ? "bg-[#2271b1] font-semibold text-white" : ["Bookings", "Contracts", "Reviews"].includes(item) ? "pl-5 text-lime" : "text-white/70"
              }`}
            >
              {item}
            </div>
          ))}
        </div>
        {/* PhotoEZ dashboard */}
        <div className="min-w-0 flex-1 bg-[#f0f0f1] p-3 sm:p-4">
          <div className="flex items-center gap-2">
            <span className="grid size-6 place-items-center rounded-md bg-brand text-[9px] font-bold text-lime">EZ</span>
            <span className="text-sm font-bold text-[#1d2327]">PhotoEZ Dashboard</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {cards.map((card) => (
              <div key={card.label} className={`rounded border-b-4 bg-white p-2 shadow-sm ${card.bar}`}>
                <span className="block text-[8px] font-semibold text-[#646970] uppercase">{card.label}</span>
                <span className="block text-base font-bold text-[#1d2327]">{card.value}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded bg-white p-2 shadow-sm">
            <span className="block text-[9px] font-bold text-[#1d2327]">Recent galleries</span>
            <div className="mt-2 grid grid-cols-4 gap-1">
              {[3, 0, 6, 1].map((i) => (
                <Photo key={i} i={i} className="aspect-square rounded-sm" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
