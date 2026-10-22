/**
 * ⚠️  PARITY WITH THE MAIN APP
 * These prompts are sensible defaults. For identical output to the main
 * NYC Unhinged app, paste the prompts from its /app/api caption + tagging
 * routes here — nothing else in the admin panel needs to change.
 */

export const TAG_PROMPT = `You are tagging an image for NYC Unhinged, a social app that turns New York and college-life moments into captioned memes.
Return 4-8 short, lowercase, descriptive tags (1-2 words each) covering subject, setting, mood and vibe.
Respond ONLY with JSON: {"title": "<3-5 word title>", "tags": ["tag1", "tag2"]}`;

export const TONES: Record<string, string> = {
  unhinged: "chaotic, absurd, over-the-top energy",
  deadpan: "dry, deadpan, understated",
  wholesome: "wholesome with a chaotic twist",
  "nyc-local": "peak New Yorker: rent, subway, bodega cats, attitude",
  "college-life": "relatable college chaos: finals, dining hall, 3am decisions",
  savage: "savage roast energy, but never cruel to real people",
};

export function captionPrompt(opts: { tags: string[]; direction?: string; tone?: string; count: number; avoid?: string[] }) {
  const tone = opts.tone && TONES[opts.tone] ? `Tone: ${TONES[opts.tone]}.` : "";
  const direction = opts.direction?.trim() ? `Creative direction from the user: "${opts.direction.trim()}".` : "";
  const avoid = opts.avoid?.length ? `Do NOT repeat or closely resemble these existing captions: ${JSON.stringify(opts.avoid)}.` : "";
  return `You write captions for NYC Unhinged, a social app that turns New York and college-life moments into funny AI-captioned posts.
Look at the image and write ${opts.count} DIFFERENT caption${opts.count > 1 ? "s" : ""}, each a single punchy line (max 140 characters), funny and specific to what's in the image.
Image tags: ${JSON.stringify(opts.tags)}.
${tone} ${direction} ${avoid}
No hashtags, no emojis unless they land the joke, nothing hateful, nothing sexual, no real named people.
Respond ONLY with JSON: {"captions": ["..."]}`;
}
