// Custom booking questions (like PhotoEZ Booking's custom fields) and the
// checks on a client's answers. Pure logic, tested in fields.test.ts.

export const BOOKING_FIELD_TYPES = ["text", "textarea", "select", "checkbox"] as const;
export type BookingFieldType = (typeof BOOKING_FIELD_TYPES)[number];

export const FIELD_TYPE_LABELS: Record<BookingFieldType, string> = {
  text: "Short text",
  textarea: "Long text",
  select: "Dropdown",
  checkbox: "Checkbox (yes/no)",
};

export type BookingField = {
  id: string;
  label: string;
  type: BookingFieldType;
  options: string[];
  required: boolean;
  sessionTypeIds: string[];
};

// Saved on the booking with the question's wording at the time.
export type BookingAnswer = { label: string; type: BookingFieldType; value: string };

// The questions asked for one session (none chosen = every session).
export function fieldsForSession<T extends Pick<BookingField, "sessionTypeIds">>(fields: T[], sessionTypeId: string) {
  return fields.filter((f) => f.sessionTypeIds.length === 0 || f.sessionTypeIds.includes(sessionTypeId));
}

const MAX_ANSWER = { text: 300, textarea: 3000, select: 300, checkbox: 3 } as const;

export type AnswerCheck = { ok: true; answers: BookingAnswer[] } | { ok: false; errors: Record<string, string> };

// `raw` maps field id → what the form sent ("on" for a ticked checkbox).
export function checkAnswers(fields: BookingField[], raw: Record<string, string | undefined>): AnswerCheck {
  const errors: Record<string, string> = {};
  const answers: BookingAnswer[] = [];
  for (const field of fields) {
    const value = (raw[field.id] ?? "").trim();
    if (field.type === "checkbox") {
      const checked = value === "on";
      if (field.required && !checked) errors[field.id] = "Please tick this box to continue.";
      answers.push({ label: field.label, type: field.type, value: checked ? "Yes" : "No" });
      continue;
    }
    if (!value) {
      if (field.required) errors[field.id] = "Please answer this question.";
      continue;
    }
    if (value.length > MAX_ANSWER[field.type]) {
      errors[field.id] = `Keep this under ${MAX_ANSWER[field.type].toLocaleString()} characters.`;
      continue;
    }
    if (field.type === "select" && !field.options.includes(value)) {
      errors[field.id] = "Choose one of the options.";
      continue;
    }
    answers.push({ label: field.label, type: field.type, value });
  }
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, answers };
}

// Most inspiration photos a client can add to one booking (as in PhotoEZ Booking).
export const MAX_INSPO_PHOTOS = 10;
