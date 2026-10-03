// Tests for slideshow songs and stepping.   npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_SONG_BYTES, checkSong, songExtension, songTitle, step } from "./slideshow.ts";

test("songs are recognized by type, or by name when the browser doesn't say", () => {
  assert.equal(songExtension("audio/mpeg", "first-dance.mp3"), "mp3");
  assert.equal(songExtension("audio/x-m4a", "song.m4a"), "m4a");
  assert.equal(songExtension("", "Our Song.MP3"), "mp3");
  assert.equal(songExtension("application/octet-stream", "song.wav"), "wav");
  assert.equal(songExtension("video/mp4", "movie.mp4"), null);
  assert.equal(songExtension("audio/ogg", "song.ogg"), null);
});

test("songs are checked for type and size", () => {
  assert.deepEqual(checkSong({ type: "audio/mpeg", name: "a.mp3", size: 5_000_000 }), { extension: "mp3" });
  assert.ok("error" in checkSong({ type: "audio/mpeg", name: "a.mp3", size: MAX_SONG_BYTES + 1 }));
  assert.ok("error" in checkSong({ type: "image/jpeg", name: "a.jpg", size: 100 }));
  assert.ok("error" in checkSong({ type: "audio/mpeg", name: "a.mp3", size: 0 }));
});

test("song titles drop the extension", () => {
  assert.equal(songTitle("first_dance.mp3"), "first dance");
  assert.equal(songTitle(".mp3"), "Song");
});

test("stepping wraps around both ends", () => {
  assert.equal(step(4, 5, 1), 0);
  assert.equal(step(0, 5, -1), 4);
  assert.equal(step(2, 5, 1), 3);
  assert.equal(step(0, 0, 1), 0);
});
