// Grades one photo's AI tags by what clients experience: the app's real
// gallery search (lib/photo-search.ts), run over a practice gallery holding
// just this photo, for every phrase the photographer wrote in searches.csv.
//   no_wrong_match  none of the "should not find" searches turns up the photo (headline)
//   all_found       every "should find" search turns it up
//   find_rate       share of "should find" searches that turn it up
//   wrong_rate      share of "should not find" searches that wrongly turn it up
// Free: no judge, just the database (the eval's in-memory Postgres, test/db.ts).
import { randomUUID } from 'node:crypto';
import { db } from '../../test/db.ts';
import { galleries, photographers, photos } from '../../db/schema.ts';
import { searchGalleryPhotos } from '../../lib/photo-search.ts';

// ---- searches.csv ---------------------------------------------------------------

// One CSV line into cells (handles Excel's quoting: "a, b" and "" for a quote).
function cells(line) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

// Phrases separated by semicolons or commas (either works in the spreadsheet).
const phrases = (cell) => [...new Set(String(cell ?? '').split(/[;,\n]/).map((p) => p.trim().toLowerCase()).filter(Boolean))];

// The photographer's searches, one case per photo that has at least one
// "should find" phrase. Rows still blank are skipped (and counted).
export function parseSearches(text) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  const header = cells(lines[0]).map((h) => h.trim().toLowerCase());
  const col = (name) => header.indexOf(name);
  for (const name of ['photo', 'should_find', 'should_not_find']) {
    if (col(name) < 0) throw new Error(`searches.csv is missing its "${name}" column`);
  }
  const cases = [];
  let blank = 0;
  for (const line of lines.slice(1)) {
    const c = cells(line);
    const photo = (c[col('photo')] ?? '').trim();
    if (!photo) continue;
    const find = phrases(c[col('should_find')]);
    const avoid = phrases(c[col('should_not_find')]);
    if (!find.length) { blank++; continue; }
    cases.push({ id: photo.replace(/\.[a-z]+$/i, ''), photo, find, avoid, notes: col('notes') >= 0 ? (c[col('notes')] ?? '').trim() : '' });
  }
  return { cases, blank };
}

// ---- The search check ------------------------------------------------------------

let studioId;
async function practiceStudio() {
  if (studioId) return studioId;
  const [row] = await db.insert(photographers).values({ name: 'Photo Tag Eval', email: `${randomUUID()}@eval.example` }).returning({ id: photographers.id });
  studioId = row.id;
  return studioId;
}

// Runs every phrase through the real gallery search, against a fresh practice
// gallery holding only this photo with the AI's description and tags.
export async function searchCheck(tags, c) {
  const photographerId = await practiceStudio();
  const [gallery] = await db
    .insert(galleries)
    .values({ photographerId, title: `Eval ${c.id}`, shareToken: randomUUID() })
    .returning({ id: galleries.id });
  const [photo] = await db
    .insert(photos)
    .values({
      galleryId: gallery.id,
      fileKey: `eval/${randomUUID()}.jpg`,
      originalName: c.photo,
      kind: 'final',
      aiDescription: tags.description,
      aiTags: tags.tags,
      aiTaggedAt: new Date(),
    })
    .returning({ id: photos.id });
  const hit = async (q) => (await searchGalleryPhotos(gallery.id, q)).includes(photo.id);
  const found = [];
  const missed = [];
  for (const q of c.find) ((await hit(q)) ? found : missed).push(q);
  const wrong = [];
  for (const q of c.avoid) if (await hit(q)) wrong.push(q);
  return { found, missed, wrong };
}

export function gradeSearches(result, c) {
  const { found, missed, wrong } = result;
  const list = (xs) => xs.map((x) => `"${x}"`).join(', ');
  return {
    grade: {
      no_wrong_match: wrong.length === 0 ? 1 : 0,
      all_found: missed.length === 0 ? 1 : 0,
      find_rate: found.length / c.find.length,
      wrong_rate: c.avoid.length ? wrong.length / c.avoid.length : 0,
    },
    explanation: {
      no_wrong_match: wrong.length ? `Wrongly found by ${list(wrong)}.` : c.avoid.length ? `Not found by ${list(c.avoid)}, as expected.` : 'No "should not find" searches for this photo.',
      all_found: missed.length ? `Missed by ${list(missed)}.` : `Found by all of ${list(found)}.`,
      find_rate: `${found.length} of ${c.find.length} searches find it.`,
      wrong_rate: `${wrong.length} of ${c.avoid.length} "should not find" searches find it.`,
    },
  };
}
