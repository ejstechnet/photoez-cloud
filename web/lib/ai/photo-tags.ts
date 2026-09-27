import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

// Gallery search: Claude looks at a small copy of each photo and writes a
// short description plus search tags, so clients can type "first dance" or
// "shots with grandma" and find them. One call per photo, made once.

// Elle chose Claude Haiku 4.5 for cost (2026-09-27): fast and cheap, and
// plenty for "who, doing what, where" tags.
export const PHOTO_TAG_MODEL = "claude-haiku-4-5";

export const photoTagsSchema = z.object({
  description: z.string().describe("One plain sentence saying what the photo shows, the way a client would describe it."),
  tags: z
    .array(z.string())
    .describe("10 to 20 short lowercase search words or phrases, most useful first."),
});
export type PhotoTags = z.infer<typeof photoTagsSchema>;

const SYSTEM_PROMPT = `You describe photos from a professional photographer's client gallery so the client can search them by typing things like "first dance", "shots with grandma", or "the dog".

Write what someone would search for:
- People: how many, and their role when it's clear from the scene (bride, groom, baby, mom, grandparent, graduate, couple, family, bridesmaids). Don't guess names, and don't describe anyone's race, ethnicity, body, or attractiveness.
- What's happening: first dance, cake cutting, ring exchange, walking, laughing, hugging, kissing, posing, jumping.
- Things in the photo: bouquet, rings, cap and gown, diploma, balloons, dog, car, cake.
- The setting and light: studio, backdrop, beach, park, church, indoors, outdoors, sunset, golden hour, night.
- The shot: close-up, portrait, full body, group photo, candid, detail shot, black and white.

Tags are lowercase, one to three words each, no duplicates.`;

// Describes one photo (a small JPEG, base64). Returns the tags and the
// tokens used, for the usage log.
export async function tagPhoto(jpegBase64: string) {
  const client = new Anthropic();
  const response = await client.beta.messages.parse({
    model: PHOTO_TAG_MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: jpegBase64 } },
          { type: "text", text: "Describe this photo for gallery search." },
        ],
      },
    ],
    output_config: { format: betaZodOutputFormat(photoTagsSchema) },
  });
  if (response.stop_reason === "max_tokens" || !response.parsed_output) {
    throw new Error("The photo description came back incomplete.");
  }
  return {
    tags: cleanTags(response.parsed_output),
    model: response.model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

// Tidies what came back: trimmed, lowercase, unique, at most 25 short tags.
export function cleanTags(result: PhotoTags): PhotoTags {
  const tags = [...new Set(result.tags.map((t) => t.trim().toLowerCase().replace(/\s+/g, " ")).filter((t) => t && t.length <= 40))];
  return { description: result.description.trim().slice(0, 400), tags: tags.slice(0, 25) };
}
