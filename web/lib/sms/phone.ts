// Phone numbers for texting, in the +15035551234 form Twilio wants. US and
// Canada numbers can be typed any common way; others need their + country code.
// Pure logic, tested in sms.test.ts.

export function toE164(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+")) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  if (digits.length === 10 && /^[2-9]/.test(digits)) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

// +15035551234 → (503) 555-1234; others as they are.
export function formatPhone(e164: string) {
  const us = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);
  return us ? `(${us[1]}) ${us[2]}-${us[3]}` : e164;
}

// For logs and lists: (503) •••-1234.
export function maskPhone(e164: string) {
  const us = /^\+1(\d{3})\d{3}(\d{4})$/.exec(e164);
  return us ? `(${us[1]}) •••-${us[2]}` : `${e164.slice(0, 3)}•••${e164.slice(-4)}`;
}
