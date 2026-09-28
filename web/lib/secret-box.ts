import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// Encrypts small secrets we must be able to read back (like a photographer's
// SwaggPress API key) before they go in the database. AES-256-GCM with a key
// derived from BETTER_AUTH_SECRET, so a copy of the database alone can't
// reveal them. Format: v1.<iv>.<tag>.<ciphertext>, base64url.
// Tested in secret-box.test.ts.

function key(secret = process.env.BETTER_AUTH_SECRET) {
  if (!secret) throw new Error("BETTER_AUTH_SECRET is missing.");
  return createHash("sha256").update(`photoez-secret-box:${secret}`).digest();
}

export function sealSecret(plain: string, secret?: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv, cipher.getAuthTag(), data].map((p) => (typeof p === "string" ? p : p.toString("base64url"))).join(".");
}

// Null when the value was tampered with or sealed under a different secret.
export function openSecret(sealed: string, secret?: string): string | null {
  const [version, iv, tag, data] = sealed.split(".");
  if (version !== "v1" || !iv || !tag || !data) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(secret), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
