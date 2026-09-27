// Review rules shared by the review form, the dashboard, and the studio page
// (like PhotoEZ Reviews). Pure functions, so they're easy to test.

export const REVIEW_MIN_CHARS = 20;
export const REVIEW_MAX_CHARS = 2000;

// "Jasmine Lee" → "Jasmine L.", so a public review doesn't show a full name.
export function defaultDisplayName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

export type ReviewInput = {
  rating: number;
  body: string;
  displayName: string;
  // A photo from their gallery, or null for none.
  photoId: string | null;
  photoConsent: boolean;
};

export type CleanReview = ReviewInput;

// Checks and tidies what the client typed. Returns the first problem, if any.
export function checkReview(input: ReviewInput): { ok: true; review: CleanReview } | { error: string } {
  const rating = Math.round(input.rating);
  if (!(rating >= 1 && rating <= 5)) return { error: "Choose a star rating." };
  const body = input.body.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (body.length < REVIEW_MIN_CHARS) return { error: "Tell us a little more (a sentence or two)." };
  if (body.length > REVIEW_MAX_CHARS) return { error: `Keep your review under ${REVIEW_MAX_CHARS} characters.` };
  const displayName = input.displayName.replace(/\s+/g, " ").trim().slice(0, 60);
  if (displayName.length < 1) return { error: "Add the name to show with your review." };
  if (input.photoId && !input.photoConsent) {
    return { error: "Tick the box to let us show your photo, or choose no photo." };
  }
  return {
    ok: true,
    review: { rating, body, displayName, photoId: input.photoId, photoConsent: Boolean(input.photoId) && input.photoConsent },
  };
}

// Average of published ratings, to one decimal ("4.8"); null with none.
export function averageRating(ratings: number[]) {
  if (ratings.length === 0) return null;
  return Math.round((ratings.reduce((sum, r) => sum + r, 0) / ratings.length) * 10) / 10;
}

// Only happy reviewers are offered the Google link, and only when the
// studio has added one (off by default).
export function offerGoogle(rating: number, googleUrl: string | null) {
  return rating >= 4 && Boolean(googleUrl && /^https:\/\//.test(googleUrl));
}
