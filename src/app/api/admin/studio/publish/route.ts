import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { handle, requirePermission, HttpError } from "@/lib/guard";
import { audit } from "@/lib/audit";
import { cleanTags } from "@/lib/gemini";
import { can } from "@/lib/roles";

/**
 * Publishes a post exactly like the main app's /create flow:
 *   (optional) insert into images  ->  insert into generations
 * Body: { image_id? , new_image?: {image_url,title,tags,curated}, user_id?, caption, prompt?, remix_of? }
 */
export const POST = handle(async (req: NextRequest) => {
  const actor = await requirePermission("studio.use");
  const { image_id, new_image, user_id, caption, prompt, remix_of } = await req.json();

  const authorId: string = user_id || actor.id;
  if (authorId !== actor.id && !can(actor.role, "studio.post_as_other")) throw new HttpError(403, "Can't post as another user");

  const text = String(caption ?? "").trim();
  if (!text) throw new HttpError(400, "Caption is required");
  if (text.length > 400) throw new HttpError(400, "Caption is too long (max 400)");

  const { data: author } = await supabaseAdmin.from("profiles").select("id, is_banned").eq("id", authorId).maybeSingle();
  if (!author) throw new HttpError(400, "That user has no profile yet — they need to sign in to the app once, or be created from Users.");
  if (author.is_banned) throw new HttpError(400, "Can't post as a banned user");

  let imageId: string | undefined = image_id;
  let createdImage = false;
  if (!imageId) {
    if (!new_image?.image_url || !new_image?.title) throw new HttpError(400, "image_id or new_image is required");
    const { data, error } = await supabaseAdmin
      .from("images")
      .insert({
        image_url: new_image.image_url,
        title: String(new_image.title).trim().slice(0, 120),
        tags: cleanTags(new_image.tags),
        owner_id: new_image.curated ? null : authorId,
      })
      .select("id")
      .single();
    if (error) throw new HttpError(500, error.message);
    imageId = data.id;
    createdImage = true;
  }

  const { data: gen, error } = await supabaseAdmin
    .from("generations")
    .insert({ user_id: authorId, image_id: imageId, caption: text, prompt: String(prompt ?? "").trim(), remix_of: remix_of ?? null })
    .select("id")
    .single();
  if (error) {
    if (createdImage && imageId) await supabaseAdmin.from("images").delete().eq("id", imageId); // don't leave an orphan
    throw new HttpError(500, error.message);
  }

  await audit(actor, "studio.publish", { type: "generation", id: gen.id }, { as_user: authorId, impersonated: authorId !== actor.id, image_id: imageId, remix_of: remix_of ?? null });
  return NextResponse.json({ generation_id: gen.id, image_id: imageId });
});
