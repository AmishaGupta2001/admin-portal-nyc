import { NextResponse } from "next/server";
import { requirePermission, errRes } from "@/lib/guard";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  try { await requirePermission("panel.access"); } catch (e) { return errRes(e); }

  const [{ data: votes }, { data: generations }, { data: authData }, { data: profiles }] =
    await Promise.all([
      supabaseAdmin.from("votes").select("*").order("created_at", { ascending: false }).limit(500),
      supabaseAdmin.from("generations").select("id, caption, user_id, images(image_url)"),
      supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }),
      supabaseAdmin.from("profiles").select("id, first_name, last_name"),
    ]);

  const genMap = Object.fromEntries((generations ?? []).map((g: any) => [g.id, g]));
  const profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]));
  const authMap = Object.fromEntries((authData?.users ?? []).map((u) => [u.id, u]));

  // Compute vote sums and totals per generation
  const voteAggs: Record<string, { sum: number; total: number }> = {};
  (votes ?? []).forEach((v: any) => {
    if (!voteAggs[v.generation_id]) voteAggs[v.generation_id] = { sum: 0, total: 0 };
    voteAggs[v.generation_id].sum += v.vote;
    voteAggs[v.generation_id].total += 1;
  });

  // Enrich votes
  const enrichedVotes = (votes ?? []).map((v: any) => {
    const gen = genMap[v.generation_id];
    const profile = profileMap[v.user_id];
    const authUser = authMap[v.user_id];
    return {
      id: v.id,
      vote: v.vote,
      created_at: v.created_at,
      caption: gen?.caption ?? "Deleted generation",
      image_url: (gen as any)?.images?.image_url ?? "",
      voter_name:
        [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
        authUser?.email?.split("@")[0] ||
        "Unknown user",
    };
  });

  // Top voted
  const genScores = Object.entries(voteAggs).map(([id, { sum, total }]) => {
    const gen = genMap[id];
    const creatorProfile = gen ? profileMap[(gen as any).user_id] : null;
    return {
      id,
      caption: (gen as any)?.caption ?? "Deleted",
      creator_name:
        [creatorProfile?.first_name, creatorProfile?.last_name].filter(Boolean).join(" ") ||
        "NYC creator",
      score: sum,
      total,
    };
  });

  const topVotedGenerations = genScores
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map(({ caption, creator_name, score }) => ({ caption, creator_name, score }));

  // Most controversial: high total votes, low absolute net score
  const mostControversial = genScores
    .filter((g) => g.total >= 3)
    .sort((a, b) => {
      // Sort by (total votes) / (|score| + 1) descending → most votes with smallest net wins
      const controversyA = a.total / (Math.abs(a.score) + 1);
      const controversyB = b.total / (Math.abs(b.score) + 1);
      return controversyB - controversyA;
    })
    .slice(0, 5)
    .map(({ caption, creator_name, score, total }) => ({ caption, creator_name, score, total }));

  const totalLols = (votes ?? []).filter((v: any) => v.vote === 1).length;
  const totalNahs = (votes ?? []).filter((v: any) => v.vote === -1).length;

  return NextResponse.json({
    totalVotes: votes?.length ?? 0,
    totalLols,
    totalNahs,
    topVotedGenerations,
    mostControversial,
    votes: enrichedVotes,
  });
}
