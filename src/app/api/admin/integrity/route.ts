import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { handle, requirePermission, HttpError } from "@/lib/guard";
import { audit } from "@/lib/audit";
import { displayName } from "@/lib/users";

/** Heuristic vote-manipulation detector. Surfaces leads — a human decides. */
export const GET = handle(async () => {
  await requirePermission("votes.moderate");

  const [{ data: votes }, { data: gens }, { data: profiles }] = await Promise.all([
    supabaseAdmin.from("votes").select("user_id, generation_id, vote, created_at").order("created_at", { ascending: true }).limit(50000),
    supabaseAdmin.from("generations").select("id, user_id"),
    supabaseAdmin.from("profiles").select("id, first_name, last_name"),
  ]);

  const creatorOf = Object.fromEntries((gens ?? []).map((g: any) => [g.id, g.user_id]));
  const nameOf = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, displayName(p, p.id.slice(0, 8))]));

  const byVoter: Record<string, { t: number; creator: string | undefined; vote: number }[]> = {};
  (votes ?? []).forEach((v: any) => {
    (byVoter[v.user_id] ??= []).push({ t: new Date(v.created_at).getTime(), creator: creatorOf[v.generation_id], vote: v.vote });
  });

  const suspects: any[] = [];
  for (const [uid, list] of Object.entries(byVoter)) {
    const reasons: string[] = [];
    let score = 0;

    // Burst: 12+ votes inside any 60s window
    let lo = 0, maxBurst = 0;
    for (let hi = 0; hi < list.length; hi++) {
      while (list[hi].t - list[lo].t > 60_000) lo++;
      maxBurst = Math.max(maxBurst, hi - lo + 1);
    }
    if (maxBurst >= 12) { reasons.push(`${maxBurst} votes in under a minute`); score += Math.min(maxBurst, 40); }

    // Concentration: >=80% of 6+ votes go to one other creator
    const perCreator: Record<string, number> = {};
    list.forEach((x) => { if (x.creator && x.creator !== uid) perCreator[x.creator] = (perCreator[x.creator] ?? 0) + 1; });
    const [topCreator, topN] = Object.entries(perCreator).sort((a, b) => b[1] - a[1])[0] ?? [];
    if (topCreator && topN >= 6 && topN / list.length >= 0.8) {
      reasons.push(`${Math.round((topN / list.length) * 100)}% of votes target ${nameOf[topCreator] ?? "one creator"}`);
      score += topN * 2;
    }

    // Self-voting
    const self = list.filter((x) => x.creator === uid).length;
    if (self > 0) { reasons.push(`${self} vote(s) on their own posts`); score += self * 3; }

    // One-sided: 25+ votes, 100% same direction
    if (list.length >= 25 && (list.every((x) => x.vote === 1) || list.every((x) => x.vote === -1))) {
      reasons.push(`${list.length} votes, all ${list[0].vote === 1 ? "LOL" : "NAH"}`);
      score += 10;
    }

    if (reasons.length) suspects.push({ user_id: uid, name: nameOf[uid] ?? uid.slice(0, 8), total_votes: list.length, reasons, score });
  }

  suspects.sort((a, b) => b.score - a.score);
  return NextResponse.json({ analysed_votes: votes?.length ?? 0, suspects: suspects.slice(0, 50) });
});

/** { user_id } — removes every vote that user has cast. */
export const POST = handle(async (req: NextRequest) => {
  const actor = await requirePermission("votes.moderate");
  const { user_id } = await req.json();
  if (!user_id) throw new HttpError(400, "user_id is required");
  const { count } = await supabaseAdmin.from("votes").select("*", { count: "exact", head: true }).eq("user_id", user_id);
  const { error } = await supabaseAdmin.from("votes").delete().eq("user_id", user_id);
  if (error) throw new HttpError(500, error.message);
  await audit(actor, "vote.purge_user", { type: "user", id: user_id }, { removed: count ?? 0 });
  return NextResponse.json({ removed: count ?? 0 });
});
