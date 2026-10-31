"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, Loader2, Pencil, Plus, RefreshCw, Trash2, UploadCloud, X } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { supabaseBrowser } from "@/lib/supabase-browser";

const SECTION = "ai-generation-examples";
const IMAGE_ENDPOINT = "/api/admin/ai-generation-examples/image";
const BUCKET = "ai-generation-examples";
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

type ExampleRow = {
  id: string;
  name: string;
  prompt_chain_id: string | null;
  description: string | null;
  input_prompt: string;
  input_data: Record<string, unknown> | null;
  expected_output: string;
  enabled: boolean;
  created_at: string;
  image_preview_url: string | null;
};

type UploadTicket = { image_path: string; token: string; content_type: string };

function rowStyle(row: ExampleRow) {
  const fromInput = row.input_data?.style_label;
  return typeof fromInput === "string" ? fromInput : row.description ?? "";
}

export default function AiGenerationExamplesPanel() {
  const toast = useToast();
  const [rows, setRows] = useState<ExampleRow[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<ExampleRow | null | undefined>(undefined);
  const [viewing, setViewing] = useState<ExampleRow | null>(null);
  const [caption, setCaption] = useState("");
  const [styleLabel, setStyleLabel] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    if (!file) {
      setFilePreview("");
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    setFilePreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [file]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api<{ rows: ExampleRow[]; count: number }>(`/api/admin/week7/${SECTION}?page=${page}&limit=50`);
      setRows(result.rows);
      setCount(result.count);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load examples");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => rows.filter((row) => `${row.expected_output} ${rowStyle(row)}`.toLowerCase().includes(search.toLowerCase())), [rows, search]);

  function openForm(row?: ExampleRow) {
    setEditing(row ?? null);
    setCaption(row?.expected_output ?? "");
    setStyleLabel(row ? rowStyle(row) : "");
    setEnabled(row?.enabled ?? true);
    setFile(null);
  }

  function closeForm() {
    setEditing(undefined);
    setCaption("");
    setStyleLabel("");
    setFile(null);
  }

  async function uploadImage(selected: File) {
    const ticket = await api<UploadTicket>(IMAGE_ENDPOINT, {
      method: "POST",
      body: { content_type: selected.type, size: selected.size },
    });
    try {
      const { error: uploadError } = await supabaseBrowser().storage.from(BUCKET).uploadToSignedUrl(ticket.image_path, ticket.token, selected, {
        contentType: ticket.content_type,
        upsert: false,
      });
      if (uploadError) throw new Error(uploadError.message);
      await api(IMAGE_ENDPOINT, { method: "PUT", body: { image_path: ticket.image_path, size: selected.size } });
      return ticket.image_path;
    } catch (cause) {
      await removeUploadedImage(ticket.image_path);
      throw cause;
    }
  }

  async function removeUploadedImage(imagePath: string) {
    try { await api(IMAGE_ENDPOINT, { method: "DELETE", body: { image_path: imagePath } }); }
    catch { console.error("Could not clean up an unused AI example image."); }
  }

  async function save() {
    const cleanCaption = caption.trim();
    const cleanStyle = styleLabel.trim();
    if (!cleanCaption) return toast.error("Add the caption for this example.");
    if (cleanCaption.length > 400) return toast.error("Captions must be 400 characters or fewer.");
    if (cleanStyle.length > 80) return toast.error("Style labels must be 80 characters or fewer.");
    if (file && !IMAGE_TYPES.includes(file.type)) return toast.error("Use a JPG, PNG, WebP, or GIF image.");
    if (file && (file.size === 0 || file.size > MAX_IMAGE_BYTES)) return toast.error("Choose an image between 1 byte and 2 MB.");

    const existingPath = typeof editing?.input_data?.image_path === "string" ? editing.input_data.image_path : "";
    if (!file && !existingPath) return toast.error("Upload an image for this example.");

    setSaving(true);
    let uploadedPath = "";
    try {
      const imagePath = file ? (uploadedPath = await uploadImage(file)) : existingPath;
      const inputData = { ...(editing?.input_data ?? {}), image_path: imagePath, style_label: cleanStyle || null };
      const payload = {
        name: cleanCaption.replace(/\s+/g, " ").slice(0, 100),
        description: cleanStyle || null,
        input_prompt: editing?.input_prompt || "Caption example paired with an uploaded image.",
        input_data: inputData,
        expected_output: cleanCaption,
        prompt_chain_id: editing?.prompt_chain_id ?? null,
        enabled,
      };
      const isUpdate = Boolean(editing?.id);
      const result = await api<{ imageCleanupWarning?: boolean }>(`/api/admin/week7/${SECTION}${isUpdate ? `/${editing?.id}` : ""}`, {
        method: isUpdate ? "PATCH" : "POST",
        body: payload,
      });
      if (result.imageCleanupWarning) toast.error("Example saved, but its old image could not be removed.");
      else toast.success(isUpdate ? "Example updated." : "Example saved.");
      closeForm();
      await load();
    } catch (cause) {
      if (uploadedPath) await removeUploadedImage(uploadedPath);
      toast.error(cause instanceof Error ? cause.message : "Could not save this example.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleEnabled(row: ExampleRow) {
    setBusyId(row.id);
    try {
      await api(`/api/admin/week7/${SECTION}/${row.id}`, { method: "PATCH", body: { enabled: !row.enabled } });
      toast.success(row.enabled ? "Example disabled." : "Example enabled.");
      await load();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not update the example.");
    } finally {
      setBusyId("");
    }
  }

  async function remove(row: ExampleRow) {
    if (!window.confirm("Delete this example and its image? This cannot be undone.")) return;
    setBusyId(row.id);
    try {
      const result = await api<{ imageCleanupWarning?: boolean }>(`/api/admin/week7/${SECTION}/${row.id}`, { method: "DELETE" });
      toast.success(result.imageCleanupWarning ? "Example deleted; its image needs cleanup." : "Example deleted.");
      if (viewing?.id === row.id) setViewing(null);
      await load();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not delete the example.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="fade-in">
      <Header title="AI Examples" subtitle="Show the caption style you want with real image examples" action={<div className="flex gap-2"><Button variant="secondary" size="sm" onClick={() => void load()} disabled={loading}><RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh</Button><Button variant="primary" size="sm" onClick={() => openForm()}><Plus size={13} /> Add example</Button></div>} />
      <div className="p-8 space-y-5">
        <div className="flex flex-wrap items-center gap-3"><input className="w-full max-w-md px-3 py-2 rounded-lg text-sm" style={{ background: "var(--bg-card)", color: "var(--text)", border: "1px solid var(--border)" }} placeholder="Search captions or styles…" value={search} onChange={(event) => setSearch(event.target.value)} /><span className="text-xs" style={{ color: "var(--text-muted)" }}>{count} examples</span></div>
        {error && <div role="alert" className="rounded-lg px-4 py-3 text-sm" style={{ color: "var(--danger)", background: "rgba(255,85,85,.1)" }}>{error}<button onClick={() => void load()} className="ml-3 underline">Retry</button></div>}
        {loading ? <div className="card p-10 text-center">Loading examples…</div> : filtered.length === 0 ? <div className="card p-10 text-center text-sm" style={{ color: "var(--text-muted)" }}>{search ? "No matching examples." : "No examples yet. Add an image and its caption to start guiding generation."}</div> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{filtered.map((row) => <article key={row.id} className="card overflow-hidden">
          <button className="block w-full text-left" onClick={() => setViewing(row)} aria-label={`View example: ${row.expected_output}`}>
            {row.image_preview_url ? <div role="img" aria-label="Example image" className="h-48 w-full bg-cover bg-center" style={{ backgroundImage: `url("${row.image_preview_url}")` }} /> : <div className="h-48 flex items-center justify-center text-sm" style={{ background: "var(--bg-card-hover)", color: "var(--text-muted)" }}>Image preview unavailable</div>}
            <div className="p-4 space-y-2"><div className="flex items-center justify-between gap-2"><span className="text-xs font-medium" style={{ color: row.enabled ? "var(--success)" : "var(--text-muted)" }}>{row.enabled ? "Enabled" : "Disabled"}</span>{rowStyle(row) && <span className="rounded-full px-2 py-1 text-[11px]" style={{ background: "var(--bg-card-hover)", color: "var(--text-muted)" }}>{rowStyle(row)}</span>}</div><p className="text-sm whitespace-pre-wrap break-words" style={{ color: "var(--text)" }}>{row.expected_output}</p></div>
          </button>
          <div className="flex justify-end gap-2 border-t p-3" style={{ borderColor: "var(--border)" }}>
            <Button variant="ghost" size="sm" onClick={() => setViewing(row)} title="View example"><Eye size={14} /> View</Button>
            <Button variant="secondary" size="sm" disabled={busyId === row.id} onClick={() => void toggleEnabled(row)}>{busyId === row.id ? <Loader2 size={13} className="animate-spin" /> : null}{row.enabled ? "Disable" : "Enable"}</Button>
            <Button variant="secondary" size="sm" onClick={() => openForm(row)} title="Edit example"><Pencil size={14} /></Button>
            <Button variant="danger" size="sm" disabled={busyId === row.id} onClick={() => void remove(row)} title="Delete example"><Trash2 size={14} /></Button>
          </div>
        </article>)}</div>}
        <div className="flex justify-end gap-2"><Button variant="secondary" size="sm" disabled={page === 0 || loading} onClick={() => setPage((value) => value - 1)}>Previous</Button><span className="px-2 self-center text-xs" style={{ color: "var(--text-muted)" }}>Page {page + 1} of {Math.max(1, Math.ceil(count / 50))}</span><Button variant="secondary" size="sm" disabled={(page + 1) * 50 >= count || loading} onClick={() => setPage((value) => value + 1)}>Next</Button></div>
      </div>

      {editing !== undefined && <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,.72)" }}><div className="card w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 space-y-4" role="dialog" aria-modal="true" aria-labelledby="ai-example-form-title">
        <div className="flex justify-between items-center"><h2 id="ai-example-form-title" className="font-semibold">{editing ? "Edit example" : "Add an example"}</h2><button onClick={closeForm} aria-label="Close"><X size={18} /></button></div>
        <label className="block text-xs space-y-2">Example image <input type="file" accept={IMAGE_TYPES.join(",")} onChange={(event) => setFile(event.target.files?.[0] ?? null)} />{filePreview ? <div role="img" aria-label="Selected example image preview" className="h-48 rounded-lg bg-cover bg-center" style={{ backgroundImage: `url("${filePreview}")` }} /> : editing?.image_preview_url ? <div role="img" aria-label="Current example image preview" className="h-48 rounded-lg bg-cover bg-center" style={{ backgroundImage: `url("${editing.image_preview_url}")` }} /> : <span className="flex items-center gap-2 rounded-lg border border-dashed p-5" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}><UploadCloud size={18} /> Upload a JPG, PNG, WebP, or GIF image (up to 8 MB).</span>}{file && <span className="block text-[11px]" style={{ color: "var(--text-muted)" }}>{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</span>}</label>
        <label className="block text-xs space-y-1">Funny caption <textarea className="w-full rounded-lg p-3 text-sm" rows={4} maxLength={400} value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="Write the caption you want the AI to learn from…" /><span className="block text-right opacity-70">{caption.length}/400</span></label>
        <label className="block text-xs space-y-1">Humor style <input className="w-full rounded-lg p-3 text-sm" maxLength={80} value={styleLabel} onChange={(event) => setStyleLabel(event.target.value)} placeholder="Optional, e.g. sarcastic, witty, relatable" /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /> Use this example for future captions</label>
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={closeForm}>Cancel</Button><Button variant="primary" disabled={saving} onClick={() => void save()}>{saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : "Save example"}</Button></div>
      </div></div>}

      {viewing && <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,.72)" }} onClick={() => setViewing(null)}><div className="card w-full max-w-2xl p-5 space-y-4" role="dialog" aria-modal="true" aria-label="AI caption example" onClick={(event) => event.stopPropagation()}><div className="flex justify-between"><h2 className="font-semibold">Caption example</h2><button onClick={() => setViewing(null)} aria-label="Close"><X size={18} /></button></div>{viewing.image_preview_url && <div role="img" aria-label="Example image" className="max-h-[55vh] min-h-48 rounded-lg bg-contain bg-no-repeat bg-center" style={{ backgroundImage: `url("${viewing.image_preview_url}")` }} />}<p className="whitespace-pre-wrap text-sm">{viewing.expected_output}</p>{rowStyle(viewing) && <p className="text-xs" style={{ color: "var(--text-muted)" }}>Style: {rowStyle(viewing)}</p>}<p className="text-xs" style={{ color: viewing.enabled ? "var(--success)" : "var(--text-muted)" }}>{viewing.enabled ? "Enabled for future caption generation" : "Disabled"}</p></div></div>}
    </div>
  );
}
