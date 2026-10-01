// Copies a nightly database backup off the server, into the private R2
// bucket under backups/db/, and keeps the last 30 days there. Run by the
// server's nightly backup (/usr/local/sbin/photoezcloud-backup):
//
//   node --env-file=.env scripts/backup-to-r2.mjs /root/backups/photoezcloud/<file>.dump
//
// To restore: download the file from R2 and run pg_restore against it.

import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { DeleteObjectsCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const KEEP_DAYS = 30;
const PREFIX = "backups/db/";

const file = process.argv[2];
if (!file) throw new Error("Give the backup file to upload.");
const bucket = process.env.R2_BUCKET;
if (!bucket) throw new Error("R2_BUCKET is missing from .env");

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
});

const body = await readFile(file);
await s3.send(new PutObjectCommand({ Bucket: bucket, Key: PREFIX + basename(file), Body: body, ContentType: "application/octet-stream" }));
console.log(`Uploaded ${basename(file)} (${Math.round(body.length / 1024)} KB)`);

// Older than KEEP_DAYS: removed from R2 (the newest are always kept).
const cutoff = Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000;
const { Contents = [] } = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: PREFIX }));
const old = Contents.filter((o) => o.Key && o.LastModified && o.LastModified.getTime() < cutoff);
if (old.length && Contents.length - old.length >= 7) {
  await s3.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: old.map((o) => ({ Key: o.Key })) } }));
  console.log(`Removed ${old.length} backup(s) older than ${KEEP_DAYS} days`);
}
