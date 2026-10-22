import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("generations")
    .select(`
      id, caption, prompt, created_at, remix_of, user_id,
      images (id, image_url, title),
      profiles (first_name, last_name)
    `)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

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
    image_url: g.images?.image_url ?? "",
    image_title: g.images?.title ?? "",
    creator_name:
      [g.profiles?.first_name, g.profiles?.last_name].filter(Boolean).join(" ") || "NYC creator",
    vote_count: voteSums[g.id] ?? 0,
  }));

  return NextResponse.json({ generations });
}
