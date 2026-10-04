# PhotoEZ Migration format, version 2

How a studio moves between **PhotoEZ Cloud** and **PhotoEZ for WordPress**
(the free *PhotoEZ Migration* plugin). Both sides implement the same
read-only **source API**; the side the studio is moving *to* pulls from it in
small batches, so photo libraries of any size can move and an interrupted
transfer simply continues.

## Connecting

1. On the **old** side the studio creates a migration key
   (Cloud: Settings → Move to PhotoEZ for WordPress; WordPress: PhotoEZ → Migration).
   Keys look like `pezm_…`, are shown once, last 7 days, and can be revoked.
2. On the **new** side they enter the old side's address and the key.
3. Every request sends `Authorization: Bearer <key>`. Keys only read; nothing
   on the old side changes.

Base addresses:

- Cloud: `https://photoezcloud.com/api/migration/v1`
- WordPress: `https://<site>/wp-json/photoez-migration/v1`

## Endpoints

All JSON, UTF-8. Money is in **cents** (integers). Dates are ISO 8601
(`2026-10-03` for days, `2026-10-03T17:00:00Z` for moments). IDs are strings
(Cloud UUIDs, WordPress numbers as strings) and are only meaningful inside one
transfer, for linking records together.

### `GET /manifest`

```json
{
  "format": "photoez-migration",
  "version": 2,
  "source": "cloud" | "wordpress",
  "studio": { "name": "Elle Jones Studios", "email": "…", "timeZone": "America/Los_Angeles" },
  "counts": { "clients": 312, "galleries": 48, "photos": 9104, "sessionTypes": 6, "addons": 4, "contracts": 2,
              "bookings": 120, "credits": 3, "reviews": 20, "invoices": 9 }
}
```

### Lists: `GET /clients`, `/galleries`, `/session-types`, `/addons`, `/contracts`

Query: `offset` (default 0), `limit` (default 50, max 100; galleries max 20).
Response: `{ "items": [...], "next": <offset> | null }`.

**Client**
```json
{ "id": "…", "name": "Tina Smith", "email": "tina@…" | null, "phone": "…" | null, "notes": "…" | null }
```
WordPress has no client list; its source builds one from the names and emails
on galleries and bookings (one client per email).

**Add-on**
```json
{ "id": "…", "name": "Extra 30 minutes", "description": "…" | null, "priceCents": 7500, "maxQuantity": 1 }
```

**Session type**
```json
{
  "id": "…", "name": "Family Session", "shortDescription": "…" | null,
  "descriptionHtml": "<p>…</p>" | null, "durationMinutes": 60, "priceCents": 25000,
  "depositPercent": 50, "location": "Studio" | null, "photosIncluded": 20 | null,
  "hidden": false, "sortOrder": 0, "imageUrl": "https://…" | null,
  "addons": [{ "addonId": "…", "includedQuantity": 0 }]
}
```
`imageUrl` is a short-lived download link; fetch it right away.

**Contract template**
```json
{ "id": "…", "title": "Portrait Contract", "contentHtml": "<p>… {{CLIENT_NAME}} …</p>", "isDefault": true }
```
Placeholders are the shared `{{TAGS}}` (CLIENT_NAME, SESSION_NAME, BOOKING_DATE, …).

**Gallery**
```json
{
  "id": "…", "title": "Smith Family", "clientId": "…" | null,
  "status": "pending" | "submitted" | "paid_and_submitted" | "delivered" | "completed" | "expired",
  "freeLimit": 10, "extraPhotoPriceCents": 1000 | null, "notesEnabled": true | null,
  "createdAt": "…", "deliveredAt": "…" | null, "expiresAt": "…" | null,
  "coverPhotoId": "…" | null,
  "photos": [
    { "id": "…", "kind": "proof" | "final", "name": "IMG_0412.jpg", "contentType": "image/jpeg",
      "width": 6000 | null, "height": 4000 | null, "sizeBytes": 18234111 | null, "position": 0,
      "selected": true, "note": "Can you soften the shadows?" | null }
  ]
}
```
`selected` / `note` are the client's picks (proofs only). Watermarked copies
are never sent: the new side makes its own from the originals with its own
watermark.

### Version 2 lists: `GET /bookings`, `/credits`, `/reviews`, `/invoices`

Same paging (bookings and invoices max 50). A version 1 source has none of
these and no matching `counts`; importers only ask for them when the manifest
says `"version": 2` or more.

**Signed contract** (inside a booking or invoice)
```json
{ "title": "Portrait Contract" | null, "contentHtml": "<p>…</p>", "signerName": "Tina Smith",
  "signatureType": "draw" | "type", "signatureData": "data:image/png;base64,…" | "Tina Smith",
  "signedAt": "…", "clientIp": "…" | null }
```

**Booking** (deposit holds that were never paid aren't sent)
```json
{
  "id": "…", "clientId": "…" | null, "clientName": "…", "clientEmail": "…", "clientPhone": "…" | null,
  "sessionTypeId": "…" | null, "sessionName": "Senior Session", "title": "Tina's Senior Photos" | null,
  "startsAt": "…", "endsAt": "…", "status": "confirmed" | "completed" | "cancelled",
  "totalCents": 22500, "addonsCents": 0, "depositPercent": 50,
  "paidCents": 11250, "creditCents": 0,
  "addons": [{ "addonId": "…" | null, "name": "Edited Photos", "priceCents": 1000, "quantity": 0, "includedQuantity": 15 }],
  "answers": [{ "label": "What high school do you attend?", "value": "Jefferson" }],
  "notes": "…" | null, "galleryId": "…" | null, "createdAt": "…", "cancelledAt": "…" | null,
  "signedContract": { … } | null,
  "inspoPhotos": [{ "id": "inspo-…", "name": "inspiration-1.jpg", "contentType": "image/jpeg" }]
}
```
`totalCents` is the whole booking with extras, less any discount.
`paidCents` is money paid; `creditCents` is session credit or a gift card put
toward it (also counts as paid). `confirmed` means it hasn't happened yet.

**Session credit**
```json
{ "id": "…", "clientEmail": "…", "clientName": "…", "amountCents": 11250, "usedCents": 0,
  "reason": "Cancelled with notice", "sourceBookingId": "…" | null, "expiresOn": "2027-01-01" | null, "createdAt": "…" }
```

**Review**
```json
{ "id": "…", "galleryId": "…" | null, "clientName": "…", "clientEmail": "…",
  "status": "requested" | "submitted" | "approved" | "rejected",
  "displayName": "Jasmine L." | null, "rating": 5 | null, "body": "…" | null,
  "photoId": "…" | null, "photoConsent": true,
  "requestedAt": "…", "submittedAt": "…" | null, "approvedAt": "…" | null }
```
`photoId` is one of the gallery's photo ids.

**Quote or invoice**
```json
{
  "id": "…", "kind": "quote" | "invoice", "number": "INV-2026-0003",
  "status": "draft" | "sent" | "approved" | "declined" | "partial" | "paid" | "cancelled",
  "clientId": "…" | null, "clientName": "…", "clientEmail": "…", "clientPhone": "…" | null,
  "title": "…", "eventDate": "2026-07-25" | null, "dueDate": "…" | null,
  "items": [{ "description": "Event photography per hour", "quantity": 4, "unitCents": 7500 }],
  "taxBps": 0, "subtotalCents": 30000, "taxCents": 0, "totalCents": 30000,
  "depositPercent": 50, "paidCents": 15000, "notes": "…" | null, "terms": "…" | null,
  "createdAt": "…", "approvedAt": "…" | null, "paidAt": "…" | null,
  "signedContract": { … } | null
}
```
`depositPercent` 0 (or 100) means paid in full at once. `taxBps` is the tax
rate in hundredths of a percent (8.25% = 825).

### `GET /photos/{id}/original`

The full-resolution original file, or a redirect to it. Importers must not
send the key to the redirect's address. Booking inspiration photos use the
same address with their `inspo-…` id.

## Importing rules

- Import order: clients → add-ons → session types → contracts → galleries
  (each gallery's photos right after it). Keep a map of old IDs → new IDs.
- Re-running an import from the same source skips anything already imported.
- Anything that can't be imported is listed in the final summary with the
  reason; the import keeps going.
- Version 2 continues: → bookings (each with its signed contract,
  inspiration photos, and add-ons) → session credits → reviews →
  quotes/invoices.
- Money already paid comes across as paid (no new charge); online payment
  links from the old side don't move, so anything still owed is paid on the
  new side.
- Upcoming bookings carry on as normal on the new side (session reminder,
  then the balance). Past and cancelled ones are marked as already reminded,
  and an already-overdue invoice or old quote isn't nudged again.
