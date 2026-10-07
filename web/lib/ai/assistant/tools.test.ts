// Studio Assistant look-ups and context (fixes from the eval's baseline).
// In-memory Postgres (test/db.ts); no Anthropic calls.   npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { blackoutDates, bookings, photographers } from "@/db/schema";
import { makeStudio, reply, scriptedModel } from "../../../test/assistant-fixtures.ts";
import { executeTool } from "./executor";
import { TOOL_REGISTRY } from "./registry";
import { askAssistant } from "./run";

test("find_time_off lists the studio's Time off in a date range", async () => {
  const s = await makeStudio();
  await db.insert(blackoutDates).values([
    { photographerId: s.studio.id, startDate: "2030-11-26", endDate: "2030-11-27", note: "Thanksgiving" },
    { photographerId: s.studio.id, startDate: "2030-12-24", endDate: "2030-12-26", note: "Holidays" },
  ]);
  // Another studio's time off never shows.
  const other = await makeStudio("Other Studio");
  await db.insert(blackoutDates).values({ photographerId: other.studio.id, startDate: "2030-11-10", endDate: "2030-11-10" });

  const november = JSON.parse((await executeTool("find_time_off", { from: "2030-11-01", to: "2030-11-30" }, s.ctx)).text);
  assert.equal(november.count, 1);
  assert.equal(november.time_off[0].note, "Thanksgiving");
  assert.match(november.time_off[0].from, /Nov 26/);
  assert.match(november.time_off[0].to, /Nov 27/);
  assert.equal(TOOL_REGISTRY.find((t) => t.name === "find_time_off")?.effect, "read");
});

test("a cancelled booking owes nothing", async () => {
  const s = await makeStudio();
  await db.update(bookings).set({ status: "cancelled" }).where(eq(bookings.id, s.booking.id));
  const found = JSON.parse((await executeTool("find_bookings", { balance_due_only: true }, s.ctx)).text);
  assert.equal(found.count, 0);
  const all = JSON.parse((await executeTool("find_bookings", {}, s.ctx)).text);
  assert.equal(all.bookings[0].due_cents, 0);
});

test("the Assistant is told the studio's name, for signing drafts", async () => {
  const s = await makeStudio();
  await db.update(photographers).set({ businessName: "Willow & Pine Photography" }).where(eq(photographers.id, s.studio.id));
  const model = scriptedModel([reply("Hi!")]);
  await askAssistant(s.studio.id, [], "Write a thank-you note", { client: model.client });
  const first = model.requests[0].messages.at(-1);
  assert.match(JSON.stringify(first?.content), /studio name Willow & Pine Photography/);
});
