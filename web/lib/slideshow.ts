// Slideshows of a gallery's final photos (Pro and Studio), with an optional
// song the photographer uploads for each gallery. The rules for songs and the
// player's timing live here, with no database, so they're tested in
// slideshow.test.ts.

// Song files browsers can play everywhere, and the extension each is stored with.
export const SONG_TYPES: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/m4a": "m4a",
  "audio/aac": "aac",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
};

// Stored with a type the browser plays, whichever name it was uploaded with.
export const SONG_CONTENT_TYPE: Record<string, string> = { mp3: "audio/mpeg", m4a: "audio/mp4", aac: "audio/aac", wav: "audio/wav" };

// About 20 minutes of a typical MP3; a full-quality WAV song fits too.
export const MAX_SONG_BYTES = 60 * 1024 * 1024;

// The type of an uploaded song, by its reported type or (when the browser
// doesn't say) its file name. Null when it isn't a song we can play.
export function songExtension(contentType: string, fileName: string): string | null {
  const byType = SONG_TYPES[contentType.toLowerCase()];
  if (byType) return byType;
  const ext = /\.([a-z0-9]{2,4})$/i.exec(fileName)?.[1]?.toLowerCase();
  return ext && ext in SONG_CONTENT_TYPE ? ext : null;
}

export function checkSong(file: { type: string; name: string; size: number }): { extension: string } | { error: string } {
  const extension = songExtension(file.type, file.name);
  if (!extension) return { error: "Choose an MP3, M4A, AAC, or WAV song." };
  if (file.size <= 0) return { error: "That file is empty." };
  if (file.size > MAX_SONG_BYTES) return { error: "That song is too large (60 MB at most). An MP3 works best." };
  return { extension };
}

// The song's name to show: its file name without the extension, tidied up.
export function songTitle(fileName: string) {
  const base = fileName.replace(/\.[a-z0-9]{2,4}$/i, "").replace(/[_]+/g, " ").trim();
  return (base || "Song").slice(0, 120);
}

// Seconds each photo shows, as the client picks.
export const SPEEDS = [
  { label: "Slow", seconds: 7 },
  { label: "Normal", seconds: 5 },
  { label: "Fast", seconds: 3 },
] as const;
export const DEFAULT_SECONDS = 5;

// The photo after (or before) this one, wrapping around at the ends.
export function step(index: number, count: number, by: 1 | -1) {
  return count === 0 ? 0 : (index + by + count) % count;
}
