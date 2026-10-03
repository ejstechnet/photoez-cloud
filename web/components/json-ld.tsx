// Structured data (schema.org JSON-LD) that tells search engines what a page
// is about: the app and its prices, an FAQ, a photography business. "<" is
// escaped so text in it can never close the script tag.
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\u003c") }} />;
}
