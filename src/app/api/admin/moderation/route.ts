import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { handle, requirePermission, HttpError } from "@/lib/guard";
import { audit } from "@/lib/audit";
import { deleteGenerations } from "@/lib/content";
import { displayName } from "@/lib/users";

const PAGE = 48;

export const GET = handle(async (req: NextRequest) => {
  await requirePermission("content.moderate");
  const sp = req.nextUrl.searchParams;
  const status = sp.get("status") ?? "all"; // all | hidden | featured | remix | visible
  const sort = sp.get("sort") ?? "new"; // new | old
  const q = (sp.get("q") ?? "").trim().replace(/[%,()]/g, " ");
  const user = sp.get("user");
  const page = Math.max(parseInt(sp.get("page") ?? "0", 10) || 0, 0);

  let query = supabaseAdmin
    .from("generations")
    .select(
      "id, caption, prompt, created_at, remix_of, user_id, is_hidden, is_featured, hidden_reason, images(id, image_url, title, tags)",
      { count: "exact" },
    )
    .order("created_at", { ascending: sort === "old" })
    .range(page * PAGE, page * PAGE + PAGE - 1);

  if (status === "hidden") query = query.eq("is_hidden", true);
  if (status === "visible") query = query.eq("is_hidden", false);
  if (status === "featured") query = query.eq("is_featured", true);
  if (status === "remix") query = query.not("remix_of", "is", null);
  if (user) query = query.eq("user_id", user);
  if (q) query = query.ilike("caption", `%${q}%`);

  const { data, error, count } = await query;
  if (error)
    throw new HttpError(
      500,
      error.message.includes("is_hidden") ||
        error.message.includes("is_featured")
        ? `${error.message} — run supabase/migrations/admin_features.sql`
        : error.message,
    );

  const userIds = Array.from(
      new Set((data ?? []).map((g: any) => g.user_id).filter(Boolean))
  );

  const { data: profiles, error: profilesError } = userIds.length
    ? await supabaseAdmin
        .from("profiles")
        .select("id, first_name, last_name, avatar_url")
        .in("id", userIds)
    : { data: [], error: null };

  if (profilesError) {
    throw new HttpError(500, profilesError.message);
  }

  const profilesById = new Map((profiles ?? []).map((p: any) => [p.id, p]));
  const ids = (data ?? []).map((g: any) => g.id);
  const sums: Record<string, { lols: number; nahs: number }> = {};
  if (ids.length) {
    const { data: votes } = await supabaseAdmin
      .from("votes")
      .select("generation_id, vote")
      .in("generation_id", ids);
    (votes ?? []).forEach((v: any) => {
      const s = (sums[v.generation_id] ??= { lols: 0, nahs: 0 });
      v.vote === 1 ? s.lols++ : s.nahs++;
    });
  }

  return NextResponse.json({
    total: count ?? 0,
    page,
    page_size: PAGE,
    items: (data ?? []).map((g: any) => ({
      id: g.id,
      caption: g.caption,
      prompt: g.prompt,
      created_at: g.created_at,
      remix_of: g.remix_of,
      user_id: g.user_id,
      is_hidden: !!g.is_hidden,
      is_featured: !!g.is_featured,
      hidden_reason: g.hidden_reason ?? null,
      image_url: g.images?.image_url ?? "",
      image_title: g.images?.title ?? "",
      tags: g.images?.tags ?? [],
      creator_name: displayName(profilesById.get(g.user_id)),
      creator_avatar: profilesById.get(g.user_id)?.avatar_url ?? null,
      lols: sums[g.id]?.lols ?? 0,
      nahs: sums[g.id]?.nahs ?? 0,
    })),
  });
});

/** Bulk actions: { ids: string[], action: hide|unhide|feature|unfeature|delete, reason? } */
export const POST = handle(async (req: NextRequest) => {
  const actor = await requirePermission("content.moderate");
  const { ids, action, reason } = await req.json();
  if (!Array.isArray(ids) || !ids.length || ids.length > 200)
    throw new HttpError(400, "Provide 1-200 ids");

  if (action === "delete") {
    await deleteGenerations(ids);
  } else {
    const patches: Record<string, Record<string, unknown>> = {
      hide: {
        is_hidden: true,
        hidden_reason: String(reason ?? "").slice(0, 300) || null,
      },
      unhide: { is_hidden: false, hidden_reason: null },
      feature: { is_featured: true },
      unfeature: { is_featured: false },
    };
    const patch = patches[action];
    if (!patch) throw new HttpError(400, "Unknown action");
    const { error } = await supabaseAdmin
      .from("generations")
      .update({ ...patch, moderated_at: new Date().toISOString() })
      .in("id", ids);
    if (error) throw new HttpError(500, error.message);
  }

  await audit(
    actor,
    `post.bulk_${action}`,
    { type: "generation" },
    { count: ids.length, ids: ids.slice(0, 50), reason: reason ?? undefined },
  );
  return NextResponse.json({ ok: true, count: ids.length });
});
