// Links to the PhotoEZ WordPress suite, kept in one place so they're easy to
// change (photoez.net is the suite's own site; ejstech.net has the demos,
// the free Lite plugin, and checkout).
export const PHOTOEZ_LINKS = {
  site: "https://photoez.net",
  demos: "https://ejstech.net/photoez-demos/",
  buy: "https://ejstech.net/buy-photoez-photography-plugins/",
  lite: "https://ejstech.net/free-wordpress-photography-plugin/",
  // The free PhotoEZ Lite plugin on WordPress.org.
  liteWordPressOrg: "https://wordpress.org/plugins/photoez-lite/",
  ejstech: "https://ejstech.net",
} as const;

// The PhotoEZ for WordPress plugins, for the home page.
export const WORDPRESS_PLUGINS = [
  { name: "PhotoEZ", body: "Client proofing galleries, favorites, paid extras, and high-res delivery." },
  { name: "PhotoEZ Booking", body: "Online booking with sessions, add-ons, deposits, and reminders." },
  { name: "PhotoEZ Photography Contracts", body: "Contracts clients sign online, filled in from each booking." },
  { name: "PhotoEZ Event Gallery", body: "Event galleries with print and digital sales for event photographers." },
  { name: "PhotoEZ Reviews", body: "Screened client reviews, requested automatically after delivery." },
] as const;
