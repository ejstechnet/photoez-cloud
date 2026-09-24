// Shared form pieces used across the app.

export const inputClass =
  "block w-full rounded-lg border border-border bg-background px-3 py-2 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 aria-invalid:border-danger";

type FieldExtras = { label: string; hint?: string; error?: string };

export function Field({
  label,
  hint,
  error,
  ...input
}: FieldExtras & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <input {...input} aria-invalid={error ? true : undefined} className={`mt-1 ${inputClass}`} />
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
      <span className="text-sm font-medium">{label}</span>
      <textarea {...textarea} aria-invalid={error ? true : undefined} className={`mt-1 ${inputClass}`} />
      <FieldMessage hint={hint} error={error} />
    </label>
  );
}

export function FieldMessage({ hint, error }: { hint?: string; error?: string }) {
  if (error) return <span className="mt-1 block text-xs text-danger">{error}</span>;
  if (hint) return <span className="mt-1 block text-xs text-muted">{hint}</span>;
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
    <button
      type="submit"
      disabled={pending}
      className={`${fullWidth ? "w-full" : "w-full sm:w-auto"} rounded-lg bg-brand px-4 py-2.5 font-medium text-brand-foreground transition hover:opacity-90 disabled:opacity-60`}
    >
      {pending ? "Please wait…" : children}
    </button>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
      {message}
    </p>
  );
}
