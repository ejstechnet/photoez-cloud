// Module resolution for tests (test/register.mjs) and scripts
// (scripts/register.mjs): "@/..." paths and imports without ".ts". Only tests
// swap "@/db" for the in-memory database.
import { existsSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = new URL("../", import.meta.url);
const testDb = new URL("./db.ts", import.meta.url).href;
let useTestDb = false;

export function initialize(data) {
  useTestDb = Boolean(data?.testDb);
}

function withExtension(url) {
  const path = fileURLToPath(url);
  if (existsSync(path) && statSync(path).isFile()) return url;
  for (const ext of [".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    if (existsSync(path + ext)) return pathToFileURL(path + ext).href;
  }
  return null;
}

export async function resolve(specifier, context, next) {
  if (specifier === "@/db" && useTestDb) return { url: testDb, shortCircuit: true };
  if (specifier.startsWith("@/")) {
    const found = withExtension(new URL(specifier.slice(2), root).href);
    if (found) return { url: found, shortCircuit: true };
  }
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
    const found = withExtension(new URL(specifier, context.parentURL).href);
    if (found) return { url: found, shortCircuit: true };
  }
  return next(specifier, context);
}
