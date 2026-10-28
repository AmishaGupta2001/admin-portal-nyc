"use client";

import { useEffect, useState } from "react";
import { Activity, Users, Image, Zap, ThumbsUp, RefreshCw, ShieldAlert } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { StatCard } from "@/components/ui/StatCard";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";

type Metrics = {
  users: { total: number; active: number; banned: number };
  images: number; generations: number; hidden: number; featured: number;
  votes: { lol: number; nah: number; total: number };
  requestStatus: Record<string, number>; responseStatus: Record<string, number>;
  requestsOverTime: { date: string; requests: number; published: number }[];
  successfulRequests: number; failedRequests: number; avgLatencyMs: number | null;
  recentRequests: Record<string, any>[]; recentAudit: Record<string, any>[];
};
const n = (v: unknown) => Number(v ?? 0).toLocaleString();

export default function ObservabilityPage() {
  const [data, setData] = useState<Metrics | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  async function load() {
    setLoading(true); setError("");
    try { setData(await api<Metrics>("/api/admin/observability")); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to load observability data"); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  const max = Math.max(1, ...(data?.requestsOverTime ?? []).flatMap((d) => [d.requests, d.published]));
  return <div className="fade-in">
    <Header title="Observability" subtitle="Live account, generation, model, and admin activity" action={<Button variant="secondary" size="sm" onClick={() => void load()} disabled={loading}><RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh</Button>} />
    <div className="p-8 space-y-7">
      {error && <div role="alert" className="p-3 rounded-lg text-sm" style={{ color: "var(--danger)", background: "rgba(255,85,85,.1)" }}>{error}<button onClick={() => void load()} className="underline ml-3">Retry</button></div>}
      <section className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Users" value={loading ? "—" : n(data?.users.total)} icon={Users} sub={`${n(data?.users.active)} active · ${n(data?.users.banned)} banned`} />
        <StatCard label="Generation requests · 30d" value={loading ? "—" : n((data?.successfulRequests ?? 0) + (data?.failedRequests ?? 0))} icon={Activity} sub={`${n(data?.successfulRequests)} succeeded · ${n(data?.failedRequests)} failed`} />
        <StatCard label="Published generations" value={loading ? "—" : n(data?.generations)} icon={Zap} sub={`${n(data?.featured)} featured · ${n(data?.hidden)} hidden`} />
        <StatCard label="LLM average latency · 30d" value={loading ? "—" : data?.avgLatencyMs == null ? "No data" : `${n(data.avgLatencyMs)} ms`} icon={Activity} />
        <StatCard label="Images" value={loading ? "—" : n(data?.images)} icon={Image} />
        <StatCard label="Votes" value={loading ? "—" : n(data?.votes.total)} icon={ThumbsUp} sub={`${n(data?.votes.lol)} LOL · ${n(data?.votes.nah)} NAH`} />
        <StatCard label="LLM response status · 30d" value={loading ? "—" : Object.values(data?.responseStatus ?? {}).reduce((a, b) => a + b, 0)} icon={Activity} sub={Object.entries(data?.responseStatus ?? {}).map(([k, v]) => `${k}: ${v}`).join(" · ") || "No responses"} />
        <StatCard label="Request status · 30d" value={loading ? "—" : Object.values(data?.requestStatus ?? {}).reduce((a, b) => a + b, 0)} icon={ShieldAlert} sub={Object.entries(data?.requestStatus ?? {}).map(([k, v]) => `${k}: ${v}`).join(" · ") || "No requests"} />
      </section>
      <section className="card p-5 space-y-4">
        <h2 className="font-semibold">Requests and published generations · last 30 days</h2>
        {loading ? <p className="text-sm">Loading activity…</p> : !data?.requestsOverTime.some((d) => d.requests || d.published) ? <p className="text-sm" style={{ color: "var(--text-muted)" }}>No activity in this period.</p> : <div className="space-y-2 max-h-80 overflow-y-auto">{data.requestsOverTime.map((day) => <div className="grid grid-cols-[90px_1fr_150px] gap-3 items-center text-xs" key={day.date}><span>{day.date}</span><div className="h-4 flex gap-1"><div title={`${day.requests} requests`} style={{ width: `${Math.max(day.requests ? 2 : 0, day.requests / max * 100)}%`, background: "var(--accent)" }} /><div title={`${day.published} published`} style={{ width: `${Math.max(day.published ? 2 : 0, day.published / max * 100)}%`, background: "#60a5fa" }} /></div><span>{day.requests} requests · {day.published} published</span></div>)}</div>}
        <div className="flex gap-4 text-xs" style={{ color: "var(--text-muted)" }}><span>🟩 Request attempts</span><span>🟦 Published generations</span></div>
      </section>
      <div className="grid xl:grid-cols-2 gap-5">
        <section className="card p-5"><h2 className="font-semibold mb-4">Recent generation requests</h2>{loading ? <p>Loading…</p> : !data?.recentRequests.length ? <p className="text-sm" style={{ color: "var(--text-muted)" }}>No requests recorded yet.</p> : <div className="space-y-3">{data.recentRequests.map((r) => <div key={r.id} className="border-b pb-3 text-xs" style={{ borderColor: "var(--border)" }}><div className="flex justify-between gap-3"><b>{r.status}</b><span>{new Date(r.created_at).toLocaleString()}</span></div><div className="truncate mt-1">{r.prompt}</div><div className="opacity-70">user {r.user_id}</div>{r.error_message && <div style={{ color: "var(--danger)" }}>{r.error_message}</div>}</div>)}</div>}</section>
        <section className="card p-5"><h2 className="font-semibold mb-4">Recent admin activity</h2>{loading ? <p>Loading…</p> : !data?.recentAudit.length ? <p className="text-sm" style={{ color: "var(--text-muted)" }}>No admin activity recorded yet.</p> : <div className="space-y-3">{data.recentAudit.map((r) => <div key={r.id} className="border-b pb-3 text-xs" style={{ borderColor: "var(--border)" }}><div className="flex justify-between gap-3"><b>{r.action}</b><span>{new Date(r.created_at).toLocaleString()}</span></div><div className="opacity-70">{r.actor_email ?? "Admin"} · {r.target_type ?? "—"} {r.target_id ?? ""}</div></div>)}</div>}</section>
      </div>
    </div>
  </div>;
}
