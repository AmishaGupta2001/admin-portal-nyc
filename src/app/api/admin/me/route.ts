import { NextResponse } from "next/server";
import { handle, requirePermission } from "@/lib/guard";

export const GET = handle(async () => {
  const actor = await requirePermission("panel.access");
  return NextResponse.json({ id: actor.id, email: actor.email, role: actor.role });
});
