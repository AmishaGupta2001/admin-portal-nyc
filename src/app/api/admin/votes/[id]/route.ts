import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { handle, requirePermission, HttpError } from "@/lib/guard";
import { audit } from "@/lib/audit";

export const DELETE = handle(async (_req: NextRequest, { params }: { params: { id: string } }) => {
  const actor = await requirePermission("votes.moderate");
  const { error } = await supabaseAdmin.from("votes").delete().eq("id", params.id);
  if (error) throw new HttpError(500, error.message);
  await audit(actor, "vote.delete", { type: "vote", id: params.id });
  return NextResponse.json({ ok: true });
});
