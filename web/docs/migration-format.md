# PhotoEZ Migration format, version 1

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
  "version": 1,
  "source": "cloud" | "wordpress",
  "studio": { "name": "Elle Jones Studios", "email": "…", "timeZone": "America/Los_Angeles" },
  "counts": { "clients": 312, "galleries": 48, "photos": 9104, "sessionTypes": 6, "addons": 4, "contracts": 2 }
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

### `GET /photos/{id}/original`

The full-resolution original file, or a redirect to it. Importers must not
send the key to the redirect's address.

## Importing rules

- Import order: clients → add-ons → session types → contracts → galleries
  (each gallery's photos right after it). Keep a map of old IDs → new IDs.
- Re-running an import from the same source skips anything already imported.
- Anything that can't be imported is listed in the final summary with the
  reason; the import keeps going.
- Version 2 adds bookings, signed contracts, session credits, reviews, and
  quotes/invoices.
