import { NextRequest, NextResponse } from "next/server";
import { handle, requirePermission, HttpError } from "@/lib/guard";
import { generateCaptions, cleanTags, GeminiError } from "@/lib/gemini";

export const maxDuration = 60;

export const POST = handle(async (req: NextRequest) => {
  await requirePermission("content.moderate"); // moderators can AI-rewrite captions; Studio UI itself needs studio.use
  const { image_url, tags, direction, tone, count, avoid } = await req.json();
  if (!image_url) throw new HttpError(400, "image_url is required");
  try {
    const captions = await generateCaptions({
      url: image_url,
      tags: cleanTags(tags),
      direction: typeof direction === "string" ? direction.slice(0, 500) : undefined,
      tone: typeof tone === "string" ? tone : undefined,
      count: Number(count) || 1,
      avoid: Array.isArray(avoid) ? avoid.slice(0, 10).map(String) : undefined,
    });
    return NextResponse.json({ captions });
  } catch (e) {
    if (e instanceof GeminiError) throw new HttpError(e.status, e.message);
    throw e;
  }
});
