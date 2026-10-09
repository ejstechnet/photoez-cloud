Whole-word, phrase-together gallery search, and tags in the everyday words clients type.

From the baseline:
- Wrong matches were mostly the search, not the AI. "man" found "pregnant woman", and "son" found "one person": the search matched letters inside other words. "white background" found a photo tagged "white bodysuit" and "beige background", because the words came from different tags.
- Misses were mostly vocabulary. Clients search "girl", "sitting", "standing", "floor" and "smiling", and clothing and background colors; the AI said "graduate", "seated" and "backdrop", or left those out.

Changes:
- lib/photo-search.ts: a search must match whole words, kept together as a phrase, within one tag or the description. Postgres word forms still apply ("dancing" finds "dance"). The whole phrase as typed, at word boundaries, is a fallback for text made only of common words ("I did it").
- lib/ai/photo-tags.ts prompt:
  - everyday words (background, not backdrop; sitting, not seated)
  - girl/boy/woman/man when it's clear
  - pose and position
  - clothing with its color
  - readable text and numbers
  - background color
  - 15 to 25 tags instead of 10 to 20

Tests: lib/photo-search.test.ts (no matches inside words, phrases kept together, word forms, numbers and text).
