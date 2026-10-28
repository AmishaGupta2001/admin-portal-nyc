import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { handle, HttpError, requirePermission } from "@/lib/guard";
import { listAllAuthUsers } from "@/lib/users";

export const GET = handle(async () => {
  await requirePermission("system.view");
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const [authUsers, bannedCount, imageCount, generationCount, hiddenCount, featuredCount, lolCount, nahCount, requests, succeededRequestCount, failedRequestCount, runningRequestCount, recentRequests, responses, responseSuccessCount, responseFailureCount, auditRows, recentGens] = await Promise.all([
    listAllAuthUsers(),
    supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).eq("is_banned", true),
    supabaseAdmin.from("images").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("generations").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("generations").select("id", { count: "exact", head: true }).eq("is_hidden", true),
    supabaseAdmin.from("generations").select("id", { count: "exact", head: true }).eq("is_featured", true),
    supabaseAdmin.from("votes").select("id", { count: "exact", head: true }).eq("vote", 1),
    supabaseAdmin.from("votes").select("id", { count: "exact", head: true }).eq("vote", -1),
    supabaseAdmin.from("generation_requests").select("status,created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(5000),
    supabaseAdmin.from("generation_requests").select("id", { count: "exact", head: true }).gte("created_at", since).eq("status", "succeeded"),
    supabaseAdmin.from("generation_requests").select("id", { count: "exact", head: true }).gte("created_at", since).eq("status", "failed"),
    supabaseAdmin.from("generation_requests").select("id", { count: "exact", head: true }).gte("created_at", since).eq("status", "running"),
    supabaseAdmin.from("generation_requests").select("id,status,prompt,user_id,created_at,error_message").order("created_at", { ascending: false }).limit(10),
    supabaseAdmin.from("llm_responses").select("status,latency_ms,created_at").gte("created_at", since).limit(5000),
    supabaseAdmin.from("llm_responses").select("id", { count: "exact", head: true }).gte("created_at", since).eq("status", "succeeded"),
    supabaseAdmin.from("llm_responses").select("id", { count: "exact", head: true }).gte("created_at", since).eq("status", "failed"),
    supabaseAdmin.from("admin_audit_log").select("id,created_at,actor_email,action,target_type,target_id").order("created_at", { ascending: false }).limit(10),
    supabaseAdmin.from("generations").select("created_at").gte("created_at", since).limit(5000),
  ]);
  const failures = [bannedCount, imageCount, generationCount, hiddenCount, featuredCount, lolCount, nahCount, requests, succeededRequestCount, failedRequestCount, runningRequestCount, recentRequests, responses, responseSuccessCount, responseFailureCount, auditRows, recentGens].find((r) => r.error);
  if (failures?.error) throw new HttpError(500, failures.error.message);
  const dayMap: Record<string, { requests: number; published: number }> = {};
  for (let offset = 29; offset >= 0; offset--) {
    const day = new Date(Date.now() - offset * 86400000).toISOString().slice(0, 10);
    dayMap[day] = { requests: 0, published: 0 };
  }
  (requests.data ?? []).forEach((row: any) => { const day = String(row.created_at).slice(0, 10); if (dayMap[day]) dayMap[day].requests++; });
  (recentGens.data ?? []).forEach((row: any) => { const day = String(row.created_at).slice(0, 10); if (dayMap[day]) dayMap[day].published++; });
  const banned = bannedCount.count ?? 0;
  const responseRows = responses.data ?? [];
  const latencies = responseRows.map((r: any) => r.latency_ms).filter((n: unknown): n is number => typeof n === "number");
  const statusCounts: Record<string, number> = { succeeded: succeededRequestCount.count ?? 0, failed: failedRequestCount.count ?? 0, running: runningRequestCount.count ?? 0 };
  const responseStatus: Record<string, number> = { succeeded: responseSuccessCount.count ?? 0, failed: responseFailureCount.count ?? 0 };
  return NextResponse.json({
    users: { total: authUsers.length, active: Math.max(0, authUsers.length - banned), banned },
    images: imageCount.count ?? 0,
    generations: generationCount.count ?? 0,
    hidden: hiddenCount.count ?? 0,
    featured: featuredCount.count ?? 0,
    votes: { lol: lolCount.count ?? 0, nah: nahCount.count ?? 0, total: (lolCount.count ?? 0) + (nahCount.count ?? 0) },
    requestStatus: statusCounts,
    responseStatus,
    requestsOverTime: Object.entries(dayMap).map(([date, values]) => ({ date, ...values })),
    successfulRequests: succeededRequestCount.count ?? 0,
    failedRequests: failedRequestCount.count ?? 0,
    avgLatencyMs: latencies.length ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length) : null,
    recentRequests: recentRequests.data ?? [],
    recentAudit: auditRows.data ?? [],
  });
});
