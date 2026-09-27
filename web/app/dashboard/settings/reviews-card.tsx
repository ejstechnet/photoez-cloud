"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field, FormError, SelectField, SubmitButton } from "@/components/form";
import { saveReviewSettings } from "./actions";

// Settings > Reviews: when clients are asked, and an optional Google review
// link for happy reviewers (off unless the photographer adds one).
export function ReviewsCard({ requestDays, googleUrl }: { requestDays: number | null; googleUrl: string | null }) {
  const [state, formAction, pending] = useActionState(saveReviewSettings, {});
  return (
    <section id="reviews" className="card scroll-mt-8 p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-bold">Reviews</h2>
        <Link href="/dashboard/reviews" className="link text-sm">
          See your reviews
        </Link>
      </div>
      <p className="mt-1 text-sm text-muted">
        Clients get a private link to review you after their gallery is delivered. You approve each review before it
        shows on your studio page.
      </p>
      <form action={formAction} className="mt-6 space-y-5">
        <SelectField label="Ask for a review" name="reviewRequestDays" defaultValue={String(requestDays ?? "off")}>
          <option value="off">Only when I click &quot;Ask for a review&quot;</option>
          <option value="1">1 day after delivery</option>
          <option value="3">3 days after delivery</option>
          <option value="5">5 days after delivery</option>
          <option value="7">1 week after delivery</option>
          <option value="14">2 weeks after delivery</option>
        </SelectField>
        <Field
          label="Google review link (optional)"
          name="googleReviewUrl"
          type="url"
          defaultValue={googleUrl ?? ""}
          placeholder="https://g.page/r/…/review"
          hint="Add it to invite clients who give 4 or 5 stars to post on Google too. Leave blank to keep reviews on PhotoEZ Cloud only."
        />
        <FormError message={state.message} />
        <div className="flex items-center gap-4">
          <SubmitButton pending={pending} fullWidth={false}>
            Save review settings
          </SubmitButton>
          {state.saved && !pending && <span className="text-sm font-semibold text-lime-ink">Saved</span>}
        </div>
      </form>
    </section>
  );
}
