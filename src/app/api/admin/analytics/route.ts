import { NextResponse } from "next/server";
import { requirePermission, errRes } from "@/lib/guard";
import { supabaseAdmin } from "@/lib/supabase";
import { format, subDays, eachDayOfInterval } from "date-fns";

export async function GET() {
  try { await requirePermission("panel.access"); } catch (e) { return errRes(e); }

  const [
    { data: generations },
    { data: votes },
    { data: profiles },
  ] = await Promise.all([
    supabaseAdmin
      .from("generations")
      .select("id, created_at, user_id, image_id")
      .order("created_at", { ascending: true }),
    supabaseAdmin
      .from("votes")
      .select("generation_id, vote, user_id, created_at")
      .order("created_at", { ascending: true }),
    supabaseAdmin.from("profiles").select("id, first_name, last_name"),
  ]);

  const { data: images } = await supabaseAdmin
    .from("images")
    .select("id, title");

  // Build date range for last 30 days
  const today = new Date();
  const days = eachDayOfInterval({ start: subDays(today, 29), end: today });

  // Generations over time
  const genByDate: Record<string, number> = {};
  days.forEach((d) => { genByDate[format(d, "MM/dd")] = 0; });
  (generations ?? []).forEach((g) => {
    const key = format(new Date(g.created_at), "MM/dd");
    if (key in genByDate) genByDate[key]++;
  });
  const generationsOverTime = Object.entries(genByDate).map(([date, count]) => ({ date, count }));

  // Votes over time
  const lolsByDate: Record<string, number> = {};
  const nahsByDate: Record<string, number> = {};
  days.forEach((d) => {
    const key = format(d, "MM/dd");
    lolsByDate[key] = 0;
    nahsByDate[key] = 0;
  });
  (votes ?? []).forEach((v) => {
    const key = format(new Date(v.created_at), "MM/dd");
    if (key in lolsByDate) {
      if (v.vote === 1) lolsByDate[key]++;
      else nahsByDate[key]++;
    }
  });
  const votesOverTime = Object.keys(lolsByDate).map((date) => ({
    date,
    lols: lolsByDate[date],
    nahs: nahsByDate[date],
  }));

  // Top creators
  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));
  const creatorGenCounts: Record<string, number> = {};
  const creatorVoteReceived: Record<string, number> = {};

  (generations ?? []).forEach((g) => {
    creatorGenCounts[g.user_id] = (creatorGenCounts[g.user_id] ?? 0) + 1;
  });

  const genUserMap = Object.fromEntries((generations ?? []).map((g) => [g.id, g.user_id]));
  const votesByGen: Record<string, number> = {};
  (votes ?? []).forEach((v) => {
    votesByGen[v.generation_id] = (votesByGen[v.generation_id] ?? 0) + v.vote;
  });
  Object.entries(votesByGen).forEach(([genId, sum]) => {
    const userId = genUserMap[genId];
    if (userId) {
      creatorVoteReceived[userId] = (creatorVoteReceived[userId] ?? 0) + sum;
    }
  });

  const topCreators = Object.entries(creatorGenCounts)
    .map(([userId, count]) => {
      const p = profileMap[userId];
      const name =
        [p?.first_name, p?.last_name].filter(Boolean).join(" ") ||
        userId.slice(0, 8);
      return { name, count, votes: creatorVoteReceived[userId] ?? 0 };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Image usage
  const imageGenCount: Record<string, number> = {};
  (generations ?? []).forEach((g) => {
    imageGenCount[g.image_id] = (imageGenCount[g.image_id] ?? 0) + 1;
  });
  const imageMap = Object.fromEntries((images ?? []).map((i: any) => [i.id, i.title]));
  const imageUsage = Object.entries(imageGenCount)
    .map(([id, count]) => ({ title: imageMap[id] ?? "Unknown", count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return NextResponse.json({
    generationsOverTime,
    votesOverTime,
    topCreators,
    imageUsage,
  });
}
