// Loaded before tests (npm test): lets Node's test runner import app code the
// way Next does ("@/..." paths, imports without ".ts"), and gives tests an
// in-memory database (test/db.ts) wherever app code imports "@/db".
import { register } from "node:module";

register("./resolve-hooks.mjs", import.meta.url);
