"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import { resolveImageUrl } from "@/lib/url";

const LABELS: Record<string, string> = { "generation-requests": "Generation Request", "llm-responses": "LLM Response" };
export default function Week7DetailPage() {
  const { section, id } = useParams<{ section: string; id: string }>();
  const router = useRouter();
  const [row, setRow] = useState<Record<string, any> | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  async function load() {
    setLoading(true); setError("");
    try { const result = await api<{ row: Record<string, any> }>(`/api/admin/week7/${section}/${id}`); setRow(result.row); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to load this record"); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [section, id]);
  const title = LABELS[section] ?? "Record";
  return <div className="fade-in">
    <Header title={`${title} detail`} subtitle={id} action={<div className="flex gap-2"><Button variant="secondary" size="sm" onClick={() => router.push(`/dashboard/observability/${section}`)}><ArrowLeft size={13} /> Back</Button><Button variant="secondary" size="sm" onClick={() => void load()} disabled={loading}><RefreshCw size={13} /> Refresh</Button></div>} />
    <div className="p-8 space-y-5">{error && <div role="alert" style={{ color: "var(--danger)" }}>{error}</div>}{loading ? <div className="card p-8">Loading details…</div> : row && <>
      {row.images?.image_url && <img className="max-h-96 max-w-full rounded-xl object-contain" src={resolveImageUrl(row.images.image_url)} alt={row.images.title ?? "Request image"} />}
      <section className="card p-5"><h2 className="font-semibold mb-4">Request and model details</h2><dl className="grid md:grid-cols-2 gap-4">{Object.entries(row).filter(([key, value]) => !["images", "generations", "generation_requests", "llm_providers", "llm_models"].includes(key) && value !== null && value !== undefined).map(([key, value]) => <div key={key}><dt className="text-xs opacity-60">{key.replaceAll("_", " ")}</dt><dd className="text-sm whitespace-pre-wrap break-words mt-1">{typeof value === "object" ? JSON.stringify(value, null, 2) : String(value)}</dd></div>)}</dl></section>
      <section className="card p-5"><h2 className="font-semibold mb-4">Related records</h2><pre className="text-xs whitespace-pre-wrap break-words">{JSON.stringify({ image: row.images, published_generation: row.generations, request: row.generation_requests, provider: row.llm_providers, model: row.llm_models }, null, 2)}</pre></section>
    </>}</div>
  </div>;
}
