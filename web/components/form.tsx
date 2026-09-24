import { ArrowRightIcon } from "./icons";

// Shared form pieces used across the app.

export const inputClass =
  "block w-full rounded-xl border-2 border-border bg-surface px-3.5 py-2.5 text-base outline-none transition placeholder:text-muted/70 focus:border-lime-ink focus:ring-4 focus:ring-lime/25 aria-invalid:border-danger";

type FieldExtras = { label: string; hint?: string; error?: string };

export function Field({
  label,
  hint,
  error,
  ...input
}: FieldExtras & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="text-sm font-semibold">{label}</span>
      <input {...input} aria-invalid={error ? true : undefined} className={`mt-1.5 ${inputClass}`} />
      <FieldMessage hint={hint} error={error} />
    </label>
  );
}

export function TextAreaField({
  label,
  hint,
  error,
  ...textarea
}: FieldExtras & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className="block">
      <span className="text-sm font-semibold">{label}</span>
      <textarea {...textarea} aria-invalid={error ? true : undefined} className={`mt-1.5 ${inputClass}`} />
      <FieldMessage hint={hint} error={error} />
    </label>
  );
}

export function SelectField({
  label,
  hint,
  error,
  children,
  ...select
}: FieldExtras & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="block">
      <span className="text-sm font-semibold">{label}</span>
      <select {...select} aria-invalid={error ? true : undefined} className={`mt-1.5 ${inputClass}`}>
        {children}
      </select>
      <FieldMessage hint={hint} error={error} />
    </label>
  );
}

export function FieldMessage({ hint, error }: { hint?: string; error?: string }) {
  if (error) return <span className="mt-1.5 block text-xs font-medium text-danger">{error}</span>;
  if (hint) return <span className="mt-1.5 block text-xs text-muted">{hint}</span>;
  return null;
}

export function SubmitButton({
  pending,
  fullWidth = true,
  children,
}: {
  pending: boolean;
  fullWidth?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button type="submit" disabled={pending} className={`btn-primary ${fullWidth ? "w-full" : "w-full sm:w-auto"}`}>
      {pending ? (
        "Please wait…"
      ) : (
        <>
          {children} <ArrowRightIcon size={18} />
        </>
      )}
    </button>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl border-2 border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm font-medium text-danger">
      {message}
    </p>
  );
}
