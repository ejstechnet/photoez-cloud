// Contract placeholders, the same {{TAGS}} as PhotoEZ Photography Contracts.
// Pure logic, tested in placeholders.test.ts.

export const PLACEHOLDERS = {
  CLIENT_NAME: "Client's name",
  CLIENT_EMAIL: "Client's email",
  CLIENT_PHONE: "Client's phone",
  SESSION_NAME: "Session booked",
  BOOKING_DATE: "Session date",
  BOOKING_TIME: "Session time",
  PHOTOGRAPHER_NAME: "Your name",
  STUDIO_NAME: "Studio name",
  STUDIO_EMAIL: "Studio email",
  TOTAL_AMOUNT: "Total (session + extras)",
  DEPOSIT_AMOUNT: "Deposit",
  BALANCE_DUE: "Balance after the deposit",
  TODAY_DATE: "Date signed",
} as const;

export type PlaceholderValues = Record<keyof typeof PLACEHOLDERS, string>;

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Fills {{TAGS}} in a contract's HTML. Values are escaped, so a client's name
// can never add markup. Unknown tags are left as written so a typo is visible.
export function fillPlaceholders(html: string, values: PlaceholderValues): string {
  return html.replace(/\{\{\s*([A-Z_]+)\s*\}\}/g, (tag, name: string) =>
    name in values ? escapeHtml(values[name as keyof PlaceholderValues]) : tag,
  );
}
