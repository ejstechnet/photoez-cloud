"use client";

import { useActionState, useState } from "react";
import { Field, FieldMessage, SubmitButton, TextAreaField } from "@/components/form";
import { LOCATION_LABELS, OFFERABLE_TYPES, SESSION_LABELS, SHOOT_LOCATIONS } from "@/lib/session-types";
import { suggestSlug } from "@/lib/studio";
import { saveStudioProfile, type StudioFormState } from "./actions";

type Profile = {
  businessName: string;
  studioSlug: string;
  studioTagline: string;
  studioBio: string;
  serviceArea: string;
  offeredTypes: string[];
  shootLocations: string[];
  quoteOnlyTypes: string[];
};

// Studio profile: what the public studio page shows, and (later) what the AI
// knows about the studio when it drafts replies.
export function StudioForm({ profile, siteUrl }: { profile: Profile; siteUrl: string }) {
  const [state, formAction, pending] = useActionState<StudioFormState, FormData>(saveStudioProfile, {});
  const errors = state.errors ?? {};
  const [name, setName] = useState(profile.businessName);
  const [slug, setSlug] = useState(profile.studioSlug);
  const [slugEdited, setSlugEdited] = useState(Boolean(profile.studioSlug));
  const [offered, setOffered] = useState(new Set(profile.offeredTypes));
  const shownSlug = slugEdited ? slug : suggestSlug(name);

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Studio name"
          name="businessName"
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={errors.businessName}
          required
        />
        <Field
          label="Page address"
          name="studioSlug"
          value={shownSlug}
          onChange={(event) => {
            setSlugEdited(true);
            setSlug(event.target.value.toLowerCase());
          }}
          error={errors.studioSlug}
          hint={`${siteUrl}/studio/${shownSlug || "your-studio"}`}
          required
        />
      </div>
      <Field
        label="Tagline"
        name="studioTagline"
        defaultValue={profile.studioTagline}
        placeholder="Portraits with personality, right here in Portland"
        error={errors.studioTagline}
        hint="Optional. One line under your studio name."
      />
      <TextAreaField
        label="About the studio"
        name="studioBio"
        rows={4}
        defaultValue={profile.studioBio}
        error={errors.studioBio}
        hint="Optional. A few sentences about you and your style."
      />
      <Field
        label="Service area"
        name="serviceArea"
        defaultValue={profile.serviceArea}
        placeholder="Portland, OR and surrounding areas"
        error={errors.serviceArea}
      />

      <fieldset>
        <legend className="text-sm font-semibold">Sessions you offer</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {OFFERABLE_TYPES.map((type) => (
            <Chip
              key={type}
              name="offeredTypes"
              value={type}
              label={SESSION_LABELS[type]}
              checked={offered.has(type)}
              onChange={(on) =>
                setOffered((current) => {
                  const next = new Set(current);
                  if (on) next.add(type);
                  else next.delete(type);
                  return next;
                })
              }
            />
          ))}
        </div>
        <FieldMessage error={errors.offeredTypes} />
      </fieldset>

      <fieldset>
        <legend className="text-sm font-semibold">Where you shoot</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {SHOOT_LOCATIONS.map((place) => (
            <Chip
              key={place}
              name="shootLocations"
              value={place}
              label={LOCATION_LABELS[place]}
              defaultChecked={profile.shootLocations.includes(place)}
            />
          ))}
        </div>
        <FieldMessage error={errors.shootLocations} />
      </fieldset>

      <fieldset>
        <legend className="text-sm font-semibold">Quote only</legend>
        <p className="text-xs text-muted">
          Services clients request a quote for instead of booking directly, like events or product photography.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {OFFERABLE_TYPES.filter((type) => offered.has(type)).map((type) => (
            <Chip
              key={type}
              name="quoteOnlyTypes"
              value={type}
              label={SESSION_LABELS[type]}
              defaultChecked={profile.quoteOnlyTypes.includes(type)}
              tone="sun"
            />
          ))}
          {offered.size === 0 && <span className="text-sm text-muted">Pick the sessions you offer first.</span>}
        </div>
      </fieldset>

      {state.saved && !pending && (
        <p role="status" className="rounded-xl bg-lime/15 px-4 py-2.5 text-sm font-semibold text-lime-ink">
          Studio profile saved.{" "}
          <a href={`/studio/${shownSlug}`} target="_blank" rel="noreferrer" className="link">
            View your studio page
          </a>
        </p>
      )}
      <SubmitButton pending={pending} fullWidth={false}>
        Save studio profile
      </SubmitButton>
    </form>
  );
}

function Chip({
  name,
  value,
  label,
  checked,
  defaultChecked,
  onChange,
  tone = "lime",
}: {
  name: string;
  value: string;
  label: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  tone?: "lime" | "sun";
}) {
  return (
    <label className="cursor-pointer">
      <input
        type="checkbox"
        name={name}
        value={value}
        checked={checked}
        defaultChecked={defaultChecked}
        onChange={onChange ? (event) => onChange(event.target.checked) : undefined}
        className="peer sr-only"
      />
      <span
        className={`inline-block rounded-full border-2 border-border px-3.5 py-1.5 text-sm font-semibold transition peer-focus-visible:ring-4 peer-focus-visible:ring-lime/30 ${
          tone === "lime"
            ? "peer-checked:border-lime peer-checked:bg-lime/15"
            : "peer-checked:border-sun peer-checked:bg-sun/25"
        }`}
      >
        {label}
      </span>
    </label>
  );
}
