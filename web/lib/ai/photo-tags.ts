import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { tokensFromApi, type CallUsage } from "./prices.ts";

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
    .describe("15 to 25 short lowercase search words or phrases, most useful first."),
});
export type PhotoTags = z.infer<typeof photoTagsSchema>;

export const SYSTEM_PROMPT = `You describe photos from a professional photographer's client gallery so the client can search them by typing things like "first dance", "shots with grandma", or "the dog".

Write what someone would search for, in the everyday words clients type (background, not backdrop; sitting, not seated):
- People: how many; girl, boy, woman, man, baby, kids or teen when it's clear; and their role when it's clear from the scene (bride, groom, mom, grandparent, graduate, couple, family, bridesmaids). Don't guess names, and don't describe anyone's race, ethnicity, body, or attractiveness.
- Pose and position: standing, sitting, lying down, kneeling, on the floor, on a chair, hugging, holding hands.
- Expression and action: smiling, laughing, first dance, cake cutting, ring exchange, walking, kissing, jumping.
- Clothing, with its color: white dress, blue gown, black suit, jeans, hoodie.
- Things in the photo: bouquet, rings, cap and gown, diploma, balloons, dog, car, cake, flowers, sign.
- Words or numbers you can read in the photo, exactly as written (class of 2026, happy birthday, love). Skip any you can't read clearly.
- The setting, light and background color: studio, white background, black background, beach, park, church, indoors, outdoors, sunset, golden hour, night.
- The shot: close-up, portrait, headshot, full body, group photo, candid, detail shot, black and white.

Tags are lowercase, one to three words each, no duplicates.`;

// Describes one photo (a small JPEG, base64). Returns the tags. onUsage is
// told the tokens as soon as the API answers, even if the answer is then cut
// off (that call is billed too), for the cost report.
export async function tagPhoto(
  jpegBase64: string,
  // Evals can try another model; the app always uses PHOTO_TAG_MODEL.
  options: { onUsage?: (usage: CallUsage) => void | Promise<void>; client?: Anthropic; model?: string } = {},
) {
  const client = options.client ?? new Anthropic();
  const started = Date.now();
  const response = await client.beta.messages.parse({
    model: options.model ?? PHOTO_TAG_MODEL,
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
  await options.onUsage?.({ model: response.model, tokens: tokensFromApi(response.usage), latencyMs: Date.now() - started });
  if (response.stop_reason === "max_tokens" || !response.parsed_output) {
    throw new Error("The photo description came back incomplete.");
  }
  return { tags: cleanTags(response.parsed_output), model: response.model };
}

// Tidies what came back: trimmed, lowercase, unique, at most 25 short tags.
export function cleanTags(result: PhotoTags): PhotoTags {
  const tags = [...new Set(result.tags.map((t) => t.trim().toLowerCase().replace(/\s+/g, " ")).filter((t) => t && t.length <= 40))];
  return { description: result.description.trim().slice(0, 400), tags: tags.slice(0, 25) };
}
