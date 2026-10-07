// Free checks of the Studio Assistant eval (no AI calls):   npm run eval:assistant:check
//   1. The practice studio's real look-ups return what the cases expect
//      (the "gold" answers are right).
//   2. Oracle: the ideal cards, made by the real propose_ tools, pass every
//      case's action check; the ideal look-ups pass every look-up check.
//   3. Null: no cards / no look-ups fail exactly the cases that need them.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { eq } from 'drizzle-orm';
import { db } from '../../test/db.ts';
import { assistantProposals } from '../../db/schema.ts';
import { executeTool, requestAction } from '../../lib/ai/assistant/executor.ts';
import { seedStudio, TIME_ZONE } from './studio.ts';
import { checkCards, checkLookups } from './grader.mjs';

const { cases } = JSON.parse(readFileSync(new URL('./cases.json', import.meta.url), 'utf8'));
const read = async (studio, name, input) => JSON.parse((await executeTool(name, input, { photographerId: studio.photographerId, timeZone: TIME_ZONE })).text);

// 1. Gold answers match what the tools return.
const s = await seedStudio();
const owed = (await read(s, 'find_bookings', { balance_due_only: true, status: 'confirmed' })).bookings.map((b) => [b.client, b.due_cents]);
assert.deepEqual(owed.sort(), [['Grace Kim', 22500], ['Maria Gonzalez', 26250], ['Priya Shah', 30000]]);
// Known app issue (2026-10-06): without status, a cancelled booking with nothing paid shows as owing.
const owedAny = (await read(s, 'find_bookings', { balance_due_only: true })).bookings.map((b) => b.client);
if (owedAny.includes('Lily Moreno')) console.log("   note: find_bookings counts Lily Moreno's CANCELLED session as owing money");
const upcoming = (await read(s, 'find_bookings', { status: 'confirmed' })).bookings.map((b) => b.client);
assert.ok(['Ben Carter', 'Maria Gonzalez', 'Priya Shah', 'Grace Kim'].every((n) => upcoming.includes(n)));
const closing = (await read(s, 'find_galleries', { closing_within_days: 7 })).galleries.map((g) => g.title).sort();
assert.deepEqual(closing, ['Gonzalez Spring', 'Whitaker Family']);
const lastMonth = (() => {
  const t = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const [y, m] = t.split('-').map(Number);
  const ym = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
  const last = new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5)), 0)).getUTCDate();
  return { from: `${ym}-01`, to: `${ym}-${last}` };
})();
assert.ok(['$645', '$645.00'].includes((await read(s, 'revenue', lastMonth)).total));
const priya = (await read(s, 'find_clients', { search: 'Priya' })).clients[0];
assert.equal(priya.phone, '503-555-0142');
const overview = await read(s, 'studio_overview', {});
assert.equal(overview.reviews_to_approve, 1);
assert.equal(overview.new_inquiries, 3);
assert.equal((await read(s, 'find_clients', { search: 'Rebecca' })).count, 0);
const timeOff = await read(s, 'find_time_off', { from: '2026-11-01', to: '2026-11-30' });
assert.equal(timeOff.count, 1);
assert.equal(timeOff.time_off[0].note, 'Thanksgiving');
console.log('1. gold answers match the practice studio: ok');

// 2 and 3. Oracle and null through the code checks.
const toolInput = (card, ids) => {
  const id = (k) => ids[k];
  if (card.tool === 'propose_balance_reminders') return { booking_ids: card.targets.map(id) };
  if (card.tool === 'propose_booking_status') return { booking_ids: card.targets.map(id), status: card.status };
  if (card.tool === 'propose_gallery_emails') return { kind: card.kind, gallery_ids: card.targets.map(id) };
  return {
    client_ids: card.targets.filter((t) => t.startsWith('client:')).map(id),
    new_recipients: card.targets.filter((t) => t.startsWith('new:')).map((t) => ({ name: 'Jessica Hale', email: t.slice(4) })),
    subject: 'Fall minis',
    message: 'Hi {first_name}, fall mini sessions are open!',
  };
};
let oracle = 0;
let nullFails = 0;
let expectNullFails = 0;
for (const c of cases) {
  const studio = await seedStudio();
  for (const card of c.expect.cards) {
    const made = await requestAction(card.tool, toolInput(card, studio.ids), { photographerId: studio.photographerId, timeZone: TIME_ZONE, traceId: null });
    assert.ok(made.proposal, `${c.id}: the ideal ${card.tool} card couldn't be made: ${made.text}`);
  }
  const rows = await db.select().from(assistantProposals).where(eq(assistantProposals.photographerId, studio.photographerId));
  const run = { ids: studio.ids, acted: null, cards: rows.map((p) => ({ tool: p.toolName, payload: p.payload })) };
  const action = checkCards(c.expect.cards, run);
  assert.ok(action.pass, `${c.id}: oracle cards failed: ${action.reason}`);
  const ideal = (c.expect.requiredTools ?? []).map((g) => g[0]);
  assert.ok(checkLookups(c.expect, ideal).pass, `${c.id}: oracle look-ups failed`);
  oracle++;

  // Null: no cards at all, no look-ups at all.
  const none = checkCards(c.expect.cards, { ids: studio.ids, acted: null, cards: [] });
  const noLookups = checkLookups(c.expect, []);
  const shouldFail = c.expect.cards.length > 0 || (c.expect.requiredTools ?? []).length > 0;
  if (shouldFail) expectNullFails++;
  if (!none.pass || !noLookups.pass) nullFails++;
  // Anything ran without approval: always a fail.
  assert.equal(checkCards(c.expect.cards, { ...run, acted: '1 card executed' }).pass, false);
  // Look-ups on a no-look-up question: a fail.
  if (c.expect.noTools) assert.equal(checkLookups(c.expect, ['find_clients']).pass, false);
}
assert.equal(nullFails, expectNullFails);
console.log(`2. oracle: ${oracle}/${cases.length} cases pass both code checks`);
console.log(`3. null: fails the ${nullFails} cases that need cards or look-ups, passes the other ${cases.length - nullFails}`);
process.exit(0);
