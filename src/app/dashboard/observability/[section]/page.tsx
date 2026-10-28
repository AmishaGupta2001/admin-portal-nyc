"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Plus, RefreshCw, Pencil, Trash2, Save, X, ChevronLeft, ChevronRight } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";

type Field = { key: string; label: string; kind?: "text" | "long" | "number" | "boolean" | "json"; required?: boolean };
type Section = { title: string; slug: string; writable: boolean; fields: Field[] };
const SECTIONS: Record<string, Section> = {
  "prompt-chains": { title: "Prompt Chains", slug: "prompt-chains", writable: true, fields: [{ key: "name", label: "Name", required: true }, { key: "description", label: "Description", kind: "long" }, { key: "enabled", label: "Enabled", kind: "boolean" }] },
  "prompt-chain-steps": { title: "Prompt Chain Steps", slug: "prompt-chain-steps", writable: true, fields: [{ key: "chain_id", label: "Chain ID", required: true }, { key: "step_order", label: "Execution order", kind: "number", required: true }, { key: "name", label: "Step name", required: true }, { key: "prompt_template", label: "Prompt template", kind: "long", required: true }, { key: "enabled", label: "Enabled", kind: "boolean" }] },
  "prompt-chain-mix": { title: "Prompt Chain Mix", slug: "prompt-chain-mix", writable: true, fields: [{ key: "chain_id", label: "Chain ID", required: true }, { key: "weight", label: "Weight", kind: "number", required: true }, { key: "enabled", label: "Enabled", kind: "boolean" }] },
  terms: { title: "Terms", slug: "terms", writable: true, fields: [{ key: "term", label: "Term", required: true }, { key: "definition", label: "Definition", kind: "long" }, { key: "category", label: "Category" }, { key: "enabled", label: "Enabled", kind: "boolean" }] },
  "generation-requests": { title: "Generation Requests", slug: "generation-requests", writable: false, fields: [] },
  "ai-generation-examples": { title: "AI Generation Examples", slug: "ai-generation-examples", writable: true, fields: [{ key: "name", label: "Name", required: true }, { key: "description", label: "Description", kind: "long" }, { key: "input_prompt", label: "Input prompt", kind: "long", required: true }, { key: "input_data", label: "Input data (JSON)", kind: "json" }, { key: "expected_output", label: "Expected output", kind: "long", required: true }, { key: "prompt_chain_id", label: "Prompt chain ID" }, { key: "enabled", label: "Enabled", kind: "boolean" }] },
  "llm-providers": { title: "LLM Providers", slug: "llm-providers", writable: true, fields: [{ key: "provider_key", label: "Provider key", required: true }, { key: "name", label: "Name", required: true }, { key: "endpoint_url", label: "Endpoint URL (informational only)" }, { key: "config", label: "Configuration metadata (JSON)", kind: "json" }, { key: "enabled", label: "Enabled", kind: "boolean" }] },
  "llm-models": { title: "LLM Models", slug: "llm-models", writable: true, fields: [{ key: "provider_id", label: "Provider ID", required: true }, { key: "model_key", label: "Model identifier", required: true }, { key: "display_name", label: "Display name", required: true }, { key: "capabilities", label: "Capabilities (JSON)", kind: "json" }, { key: "enabled", label: "Enabled", kind: "boolean" }] },
  "llm-responses": { title: "LLM Responses", slug: "llm-responses", writable: false, fields: [] },
  "allowed-signup-domains": { title: "Allowed Signup Domains", slug: "allowed-signup-domains", writable: true, fields: [{ key: "domain", label: "Domain", required: true }, { key: "enabled", label: "Enabled", kind: "boolean" }] },
  "whitelisted-emails": { title: "Whitelisted Emails", slug: "whitelisted-emails", writable: true, fields: [{ key: "email", label: "Email address", required: true }, { key: "enabled", label: "Enabled", kind: "boolean" }] },
};

const DEFAULTS: Record<string, unknown> = { enabled: true, weight: 1, step_order: 1, input_data: {}, config: {}, capabilities: [] };
const pretty = (value: unknown) => typeof value === "string" ? value : JSON.stringify(value ?? "", null, 2);
const date = (value: unknown) => value ? new Date(String(value)).toLocaleString() : "—";

export default function Week7SectionPage() {
  const params = useParams<{ section: string }>();
  const section = SECTIONS[params.section];
  const toast = useToast();
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [page, setPage] = useState(0);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Record<string, any> | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!section) return;
    setLoading(true); setError("");
    try {
      const result = await api<{ rows: Record<string, any>[]; count: number }>(`/api/admin/week7/${section.slug}?page=${page}&limit=50`);
      setRows(result.rows); setCount(result.count);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load records"); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [section?.slug, page]);

  function openForm(row?: Record<string, any>) {
    setEditing(row ?? {});
    const defaultEnabled = !["prompt-chains", "llm-providers", "llm-models"].includes(section.slug);
    setForm(Object.fromEntries(section.fields.map((field) => [field.key, row?.[field.key] ?? (field.key === "enabled" ? defaultEnabled : DEFAULTS[field.key] ?? (field.kind === "json" ? (field.key === "capabilities" ? [] : {}) : field.kind === "boolean" ? true : ""))])));
  }
  async function save() {
    if (!section) return;
    const payload: Record<string, unknown> = {};
    try {
      for (const field of section.fields) {
        const value = form[field.key];
        if (field.required && (value === "" || value == null)) throw new Error(`${field.label} is required`);
        if (field.kind === "json" && typeof value === "string") payload[field.key] = JSON.parse(value || (field.key === "capabilities" ? "[]" : "{}"));
        else if (field.kind === "number") payload[field.key] = value === "" ? null : Number(value);
        else payload[field.key] = value;
      }
      setSaving(true);
      const isEditing = Boolean(editing?.id);
      await api(`/api/admin/week7/${section.slug}${isEditing ? `/${editing?.id}` : ""}`, { method: isEditing ? "PATCH" : "POST", body: payload });
      setEditing(null); toast.success(isEditing ? "Changes saved" : "Record created"); await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Unable to save record"); }
    finally { setSaving(false); }
  }
  async function remove(row: Record<string, any>) {
    if (!section || !window.confirm(`Delete this ${section.title.toLowerCase()} record? This cannot be undone.`)) return;
    try { await api(`/api/admin/week7/${section.slug}/${row.id}`, { method: "DELETE" }); toast.success("Record deleted"); await load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Unable to delete record"); }
  }
  const filtered = useMemo(() => rows.filter((row) => JSON.stringify(row).toLowerCase().includes(search.toLowerCase())), [rows, search]);

  if (!section) return <div className="p-8">Unknown admin section.</div>;
  return <div className="fade-in">
    <Header title={section.title} subtitle={section.writable ? "Manage configuration with server-validated changes" : "Read-only operational history"} action={<div className="flex gap-2"><Button variant="secondary" size="sm" onClick={() => void load()} disabled={loading}><RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh</Button>{section.writable && <Button variant="primary" size="sm" onClick={() => openForm()}><Plus size={13} /> Add</Button>}</div>} />
    <div className="p-8 space-y-5">
      <div className="flex flex-wrap items-center gap-3"><input className="w-full max-w-md px-3 py-2 rounded-lg text-sm" style={{ background: "var(--bg-card)", color: "var(--text)", border: "1px solid var(--border)" }} placeholder="Search this page…" value={search} onChange={(e) => setSearch(e.target.value)} /><span className="text-xs" style={{ color: "var(--text-muted)" }}>{count} records · 50 per page</span></div>
      {error && <div role="alert" className="rounded-lg px-4 py-3 text-sm" style={{ color: "var(--danger)", background: "rgba(255,85,85,.1)" }}>{error}<button onClick={() => void load()} className="ml-3 underline">Retry</button></div>}
      <div className="card overflow-x-auto"><table className="admin-table"><thead><tr><th>Record</th><th>Details</th><th>Updated / created</th>{section.writable && <th>Actions</th>}</tr></thead><tbody>
        {loading ? <tr><td colSpan={section.writable ? 4 : 3} className="text-center py-12">Loading records…</td></tr> : filtered.length === 0 ? <tr><td colSpan={section.writable ? 4 : 3} className="text-center py-12" style={{ color: "var(--text-muted)" }}>{search ? "No matching records." : "No records yet."}</td></tr> : filtered.map((row) => <tr key={row.id}><td><div className="font-medium" style={{ color: "var(--text)" }}>{section.slug === "generation-requests" || section.slug === "llm-responses" ? <Link className="underline" href={`/dashboard/observability/${section.slug}/${row.id}`}>{row.name ?? row.term ?? row.email ?? row.domain ?? row.display_name ?? row.provider_key ?? row.prompt ?? row.input_prompt ?? row.id}</Link> : row.name ?? row.term ?? row.email ?? row.domain ?? row.display_name ?? row.provider_key ?? row.prompt ?? row.input_prompt ?? row.id}</div><div className="text-[10px] font-mono opacity-60">{row.id}</div></td><td><div className="max-w-2xl text-xs whitespace-pre-wrap break-words" style={{ color: "var(--text-muted)" }}>{section.slug === "llm-responses" ? `Status: ${row.status ?? "—"} · Latency: ${row.latency_ms ?? "—"} ms\nProvider/model: ${row.llm_providers?.name ?? row.provider_id ?? "—"} / ${row.llm_models?.display_name ?? row.model_id ?? "—"}\nRequest: ${row.generation_requests?.prompt ?? row.request_id ?? "—"}\nResponse: ${pretty(row.response_content ?? row.error_message)}` : section.slug === "generation-requests" ? `Status: ${row.status} · User: ${row.user_id ?? "—"}\nPrompt: ${row.prompt}\nError: ${row.error_message ?? "—"}\nOutput: ${row.generations?.caption ?? row.generation_id ?? "—"}` : pretty(Object.fromEntries(section.fields.map((field) => [field.label, row[field.key]])))}</div></td><td>{date(row.created_at ?? row.updated_at)}</td>{section.writable && <td><div className="flex gap-2"><button title="Edit" onClick={() => openForm(row)}><Pencil size={14} /></button><button title="Delete" style={{ color: "var(--danger)" }} onClick={() => void remove(row)}><Trash2 size={14} /></button></div></td>}</tr>)}
      </tbody></table></div>
      <div className="flex justify-end gap-2"><Button variant="secondary" size="sm" disabled={page === 0 || loading} onClick={() => setPage((p) => p - 1)}><ChevronLeft size={14} /> Previous</Button><span className="px-2 self-center text-xs" style={{ color: "var(--text-muted)" }}>Page {page + 1} of {Math.max(1, Math.ceil(count / 50))}</span><Button variant="secondary" size="sm" disabled={(page + 1) * 50 >= count || loading} onClick={() => setPage((p) => p + 1)}>Next <ChevronRight size={14} /></Button></div>
    </div>
    {editing !== null && <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,.72)" }}><div className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4" role="dialog" aria-modal="true"><div className="flex justify-between"><h2 className="font-semibold">{Object.keys(editing).length ? "Edit" : "Create"} {section.title}</h2><button onClick={() => setEditing(null)} aria-label="Close"><X size={18} /></button></div>{section.fields.map((field) => <label key={field.key} className="block text-xs space-y-1">{field.label}{field.kind === "boolean" ? <input className="ml-2" type="checkbox" checked={Boolean(form[field.key])} onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.checked }))} /> : field.kind === "long" || field.kind === "json" ? <textarea className="w-full p-2 rounded" rows={field.kind === "json" ? 6 : 4} value={field.kind === "json" && typeof form[field.key] !== "string" ? JSON.stringify(form[field.key] ?? {}, null, 2) : String(form[field.key] ?? "")} onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.value }))} /> : <input className="w-full p-2 rounded" type={field.kind === "number" ? "number" : "text"} min={field.kind === "number" ? 1 : undefined} step={field.key === "weight" ? "any" : undefined} value={String(form[field.key] ?? "")} onChange={(e) => setForm((f) => ({ ...f, [field.key]: field.kind === "number" ? Number(e.target.value) : e.target.value }))} />}{section.slug === "llm-providers" && field.key === "endpoint_url" && <span className="block text-[11px] opacity-70">The caption backend currently uses Gemini&apos;s fixed API endpoint. This value is stored as metadata only; editing it does not change the provider or request URL.</span>}</label>)}{section.slug === "llm-models" && <p className="text-xs opacity-75">Captioning selects the newest enabled model associated with the enabled Google Gemini provider. If none is enabled, it uses GEMINI_MODEL, then the built-in fallback. A disabled provider or invalid model identifier stops generation with a configuration error.</p>}{section.slug === "llm-providers" && <p className="text-xs opacity-75">Only Google Gemini REST is wired to caption generation. Other provider records are administrative metadata and are not runtime backends.</p>}<div className="flex justify-end gap-2"><Button variant="ghost" size="sm" onClick={() => setEditing(null)}>Cancel</Button><Button variant="primary" size="sm" disabled={saving} onClick={() => void save()}><Save size={13} />{saving ? "Saving…" : "Save"}</Button></div></div></div>}
  </div>;
}
