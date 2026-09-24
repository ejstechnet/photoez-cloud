import { NewInquiryForm } from "./new-inquiry-form";

export default function NewInquiryPage() {
  return (
    <div className="max-w-3xl">
      <p className="text-sm font-bold tracking-wider text-coral uppercase">Inquiries</p>
      <h1 className="mt-1 font-display text-4xl font-bold tracking-tight">New inquiry</h1>
      <p className="mt-2 text-muted">
        The AI reads it, pulls out the details, and drafts a reply you can edit before sending.
      </p>
      <div className="card mt-8 p-6 sm:p-8">
        <NewInquiryForm />
      </div>
    </div>
  );
}
