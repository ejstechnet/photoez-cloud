// Free checks of the photo-tagging grader (no AI calls):   npm run eval:photo-tags:check
//   1. Oracle: tags that are exactly the "should find" phrases pass every case.
//   2. Null: no tags at all are found by nothing and match nothing.
//   3. Liar: tags that include the "should not find" phrases are caught.
// Runs on the filled-in rows of searches.csv, plus a fixed example.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gradeSearches, parseSearches, searchCheck } from './grader.mjs';

const { cases: filled, blank } = parseSearches(readFileSync(new URL('./searches.csv', import.meta.url), 'utf8'));
const example = { id: 'example', photo: 'example.jpg', find: ['bride', 'bouquet', 'first dance', 'dancing'], avoid: ['groom', 'black and white'] };
const cases = [example, ...filled];
console.log(`searches.csv: ${filled.length} photos filled in, ${blank} still blank`);

let oracle = 0;
for (const c of cases) {
  // Oracle: tag with exactly what she'd search for (minus anything that's also a "should not").
  // Whole words, the way the search matches ("man" isn't inside "pregnant woman").
  const word = (phrase, inside) => ` ${inside.toLowerCase()} `.includes(` ${phrase.toLowerCase()} `);
  const tags = c.find.filter((f) => !c.avoid.some((a) => word(a, f)));
  const g = gradeSearches(await searchCheck({ description: '', tags }, c), c);
  if (g.grade.all_found && g.grade.no_wrong_match) oracle++;
  else console.log(`  oracle doesn't pass ${c.photo}: ${g.explanation.all_found} ${g.explanation.no_wrong_match}`);

  const none = gradeSearches(await searchCheck({ description: '', tags: [] }, c), c);
  assert.equal(none.grade.find_rate, 0, `${c.photo}: empty tags were found`);
  assert.equal(none.grade.no_wrong_match, 1);

  if (c.avoid.length) {
    const liar = gradeSearches(await searchCheck({ description: '', tags: [...c.find, ...c.avoid] }, c), c);
    assert.equal(liar.grade.no_wrong_match, 0, `${c.photo}: a made-up tag wasn't caught`);
  }
}
// Word forms work the way the app's search does ("dancing" finds "dance").
const forms = gradeSearches(await searchCheck({ description: 'A couple dances at their reception.', tags: [] }, { ...example, find: ['dancing'], avoid: [] }), { ...example, find: ['dancing'], avoid: [] });
assert.equal(forms.grade.all_found, 1);
console.log(`oracle: ${oracle}/${cases.length} pass; empty tags fail every search; made-up tags are caught`);
process.exit(0);
