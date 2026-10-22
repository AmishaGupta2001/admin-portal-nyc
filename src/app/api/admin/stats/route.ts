import { NextResponse } from "next/server";
import { requirePermission, errRes } from "@/lib/guard";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  try { await requirePermission("panel.access"); } catch (e) { return errRes(e); }

  const [
    { count: totalUsers },
    { count: totalGenerations },
    { count: totalImages },
    { count: totalVotes },
    { count: totalLols },
    { count: totalNahs },
    { count: totalRemixes },
    { data: recentGenerations },
    { data: topGenerations },
    { data: images },
  ] = await Promise.all([
    supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }),
    supabaseAdmin.from("generations").select("*", { count: "exact", head: true }),
    supabaseAdmin.from("images").select("*", { count: "exact", head: true }),
    supabaseAdmin.from("votes").select("*", { count: "exact", head: true }),
    supabaseAdmin.from("votes").select("*", { count: "exact", head: true }).eq("vote", 1),
    supabaseAdmin.from("votes").select("*", { count: "exact", head: true }).eq("vote", -1),
    supabaseAdmin.from("generations").select("*", { count: "exact", head: true }).not("remix_of", "is", null),
    supabaseAdmin
      .from("generations")
      .select("id, caption, created_at, image_id, user_id, profiles(first_name, last_name), images(image_url)")
      .order("created_at", { ascending: false })
      .limit(10),
    // Top by vote sum — we'll compute in app since supabase doesn't support window funcs easily
    supabaseAdmin
      .from("generations")
      .select("id, caption, user_id, profiles(first_name, last_name)")
      .limit(50),
    supabaseAdmin.from("images").select("tags"),
  ]);

  // Compute vote sums for top generations
  const { data: voteData } = await supabaseAdmin
    .from("votes")
    .select("generation_id, vote");

  const voteSums: Record<string, number> = {};
  const remixCounts: Record<string, number> = {};

  (voteData ?? []).forEach(({ generation_id, vote }) => {
    voteSums[generation_id] = (voteSums[generation_id] ?? 0) + vote;
  });

  const { data: remixData } = await supabaseAdmin
    .from("generations")
    .select("remix_of")
    .not("remix_of", "is", null);

  (remixData ?? []).forEach(({ remix_of }) => {
    if (remix_of) remixCounts[remix_of] = (remixCounts[remix_of] ?? 0) + 1;
  });

  const enrichedTop = (topGenerations ?? [])
    .map((g: any) => ({
      id: g.id,
      caption: g.caption,
      creator_name:
        [g.profiles?.first_name, g.profiles?.last_name].filter(Boolean).join(" ") || "NYC creator",
      vote_count: voteSums[g.id] ?? 0,
      remix_count: remixCounts[g.id] ?? 0,
    }))
    .sort((a, b) => b.vote_count - a.vote_count)
    .slice(0, 5);

  const enrichedRecent = (recentGenerations ?? []).map((g: any) => ({
    id: g.id,
    caption: g.caption,
    created_at: g.created_at,
    image_url: g.images?.image_url ?? "",
    creator_name:
      [g.profiles?.first_name, g.profiles?.last_name].filter(Boolean).join(" ") || "NYC creator",
    vote_count: voteSums[g.id] ?? 0,
  }));

  // Tag distribution
  const tagCount: Record<string, number> = {};
  (images ?? []).forEach((img: any) => {
    (img.tags ?? []).forEach((t: string) => {
      tagCount[t] = (tagCount[t] ?? 0) + 1;
    });
  });
  const tagDistribution = Object.entries(tagCount)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);

  return NextResponse.json({
    totalUsers: totalUsers ?? 0,
    totalGenerations: totalGenerations ?? 0,
    totalImages: totalImages ?? 0,
    totalVotes: totalVotes ?? 0,
    totalLols: totalLols ?? 0,
    totalNahs: totalNahs ?? 0,
    totalRemixes: totalRemixes ?? 0,
    recentGenerations: enrichedRecent,
    topGenerations: enrichedTop,
    tagDistribution,
  });
}
