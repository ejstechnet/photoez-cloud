// Lets a script run app code with plain Node, against the real database in
// web/.env:
//   node --env-file=.env --import ./scripts/register.mjs scripts/<name>.ts
import { register } from "node:module";

register("../test/resolve-hooks.mjs", import.meta.url, { data: { testDb: false } });
