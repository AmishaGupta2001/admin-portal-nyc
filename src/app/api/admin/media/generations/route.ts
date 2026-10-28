import { supabaseAdmin } from "@/lib/supabase";
import { handle, requirePermission, HttpError } from "@/lib/guard";

export const GET = handle(async () => {
  await requirePermission("panel.access");

  const { data, error } = await supabaseAdmin
    .from("generations")
    .select(`
      id, caption, prompt, created_at, remix_of, user_id, is_hidden, is_featured, hidden_reason, moderated_at,
      images (id, image_url, title),
      profiles (id, first_name, last_name)
    `)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw new HttpError(500, error.message);

  // Get vote sums
  const { data: votes } = await supabaseAdmin.from("votes").select("generation_id, vote");
  const voteSums: Record<string, number> = {};
  (votes ?? []).forEach(({ generation_id, vote }) => {
    voteSums[generation_id] = (voteSums[generation_id] ?? 0) + vote;
  });

  const generations = (data ?? []).map((g: any) => ({
    id: g.id,
    caption: g.caption,
    prompt: g.prompt,
    created_at: g.created_at,
    remix_of: g.remix_of,
    owner_id: g.user_id,
    is_hidden: !!g.is_hidden,
    is_featured: !!g.is_featured,
    hidden_reason: g.hidden_reason ?? null,
    moderated_at: g.moderated_at ?? null,
    image_url: g.images?.image_url ?? "",
    image_title: g.images?.title ?? "",
    creator_name:
      [g.profiles?.first_name, g.profiles?.last_name].filter(Boolean).join(" ") || "NYC creator",
    vote_count: voteSums[g.id] ?? 0,
  }));

  return Response.json({ generations });
});
