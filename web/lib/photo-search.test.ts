// Gallery search: whole words and phrases, so a client's search finds the
// right photos and no others. In-memory Postgres (test/db.ts).   npm test
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { db } from "@/db";
import { photos } from "@/db/schema";
import { makeStudio } from "../test/assistant-fixtures.ts";
import { searchGalleryPhotos } from "./photo-search";

async function photo(galleryId: string, description: string, tags: string[]) {
  const [row] = await db
    .insert(photos)
    .values({ galleryId, fileKey: `t/${randomUUID()}.jpg`, originalName: "x.jpg", kind: "final", aiDescription: description, aiTags: tags, aiTaggedAt: new Date() })
    .returning({ id: photos.id });
  return row.id;
}

test("a search matches whole words and keeps phrases together", async () => {
  const s = await makeStudio();
  const g = s.gallery.id;
  const maternity = await photo(g, "A pregnant woman poses for a maternity portrait in a studio.", ["pregnant woman", "maternity", "one person", "white bodysuit", "beige background", "carpet", "education"]);
  const couple = await photo(g, "A man and a woman dance at their reception.", ["couple", "first dance", "white background", "groom"]);
  const grad = await photo(g, "A graduate holds a sign that says I did it!", ["graduate", "class of 2026", "sign"]);
  const find = (q: string) => searchGalleryPhotos(g, q);

  // Whole words: no matches inside other words.
  assert.deepEqual(await find("man"), [couple]);
  assert.deepEqual(await find("son"), []);
  assert.deepEqual(await find("cat"), []);
  assert.deepEqual(await find("car"), []);
  assert.deepEqual(await find("pet"), []);
  // Phrases stay together: "white bodysuit" + "beige background" isn't "white background".
  assert.deepEqual(await find("white background"), [couple]);
  // Word forms still work.
  assert.deepEqual(await find("dancing"), [couple]);
  assert.deepEqual(await find("Pregnant Woman"), [maternity]);
  // Numbers and text in the photo.
  assert.deepEqual(await find("class of 2026"), [grad]);
  assert.deepEqual(await find("I did it!"), [grad]);
  assert.deepEqual(await find("2026"), [grad]);
  // Nothing typed, nothing found.
  assert.deepEqual(await find("   "), []);
});
