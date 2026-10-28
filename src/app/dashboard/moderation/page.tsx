"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Search, RefreshCw, EyeOff, Eye, Star, Pencil, Trash2, Sparkles, GitMerge, ChevronLeft, ChevronRight, X, Wand2 } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal, Field, inputStyle } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useMe } from "@/components/admin/MeProvider";
import { api, timeAgo } from "@/lib/api";
import { resolveImageUrl } from "@/lib/url";
import { TONES } from "@/lib/prompts";

interface Item {
  id: string; caption: string; prompt: string; created_at: string; remix_of: string | null; user_id: string;
  is_hidden: boolean; is_featured: boolean; hidden_reason: string | null;
  image_url: string; image_title: string; tags: string[]; creator_name: string; lols: number; nahs: number;
}
interface Resp { items: Item[]; total: number; page: number; page_size: number }

const STATUS = [["all", "All"], ["visible", "Visible"], ["hidden", "Hidden"], ["featured", "Featured"], ["remix", "Remixes"]] as const;

function ModerationInner() {
  const toast = useToast();
  const router = useRouter();
  const { can } = useMe();
  const sp = useSearchParams();
  const status = sp.get("status") ?? "all";
  const userFilter = sp.get("user");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("new");
  const [page, setPage] = useState(0);
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [edit, setEdit] = useState<Item | null>(null);
  const [hide, setHide] = useState<string[] | null>(null);
  const [del, setDel] = useState<string[] | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ status, sort, page: String(page) });
      if (q.trim()) p.set("q", q.trim());
      if (userFilter) p.set("user", userFilter);
      setData(await api<Resp>(`/api/admin/moderation?${p}`));
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to load"); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, sort, page, q, userFilter]);

  useEffect(() => { const t = setTimeout(load, q ? 300 : 0); return () => clearTimeout(t); }, [load, q]);
  useEffect(() => { setPage(0); setSel(new Set()); }, [status, sort, q, userFilter]);

  const setStatus = (s: string) => { const p = new URLSearchParams(sp.toString()); s === "all" ? p.delete("status") : p.set("status", s); router.replace(`/dashboard/moderation?${p}`); };
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  async function bulk(ids: string[], action: string, reason?: string) {
    try {
      await api("/api/admin/moderation", { method: "POST", body: { ids, action, reason } });
      toast.success(`${action} · ${ids.length} post${ids.length > 1 ? "s" : ""}`);
      setSel(new Set()); setHide(null); setDel(null); load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  const totalPages = data ? Math.max(Math.ceil(data.total / data.page_size), 1) : 1;

  return (
    <div className="fade-in">
      <Header title="Moderation" subtitle={data ? `${data.total} posts match` : "Loading…"}
        action={<Button size="sm" onClick={load} disabled={loading}><RefreshCw size={13} className={loading ? "animate-spin" : ""} /></Button>} />

      <div className="p-8 space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: "var(--bg-card)" }}>
            {STATUS.map(([k, l]) => (
              <button key={k} onClick={() => setStatus(k)} className="px-3 py-1.5 rounded-lg text-[13px] font-medium"
                style={status === k ? { background: "var(--accent)", color: "var(--accent-fg)" } : { color: "var(--text-muted)" }}>{l}</button>
            ))}
          </div>
          <div className="relative w-full max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search captions…" className="w-full pl-9 pr-4 py-2 rounded-lg text-[13px] outline-none" style={inputStyle} />
          </div>
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="px-3 py-2 rounded-lg text-[13px] outline-none" style={inputStyle}>
            <option value="new">Newest</option><option value="old">Oldest</option>
          </select>
          {userFilter && (
            <button onClick={() => { const p = new URLSearchParams(sp.toString()); p.delete("user"); router.replace(`/dashboard/moderation?${p}`); }}
              className="inline-flex items-center gap-1 text-[12px] px-2.5 py-1.5 rounded-lg" style={{ background: "var(--bg-card)", color: "var(--text)", border: "1px solid var(--border)" }}>
              One user only <X size={12} />
            </button>
          )}
        </div>

        {sel.size > 0 && (
          <div className="card px-4 py-2.5 flex items-center gap-2 fade-in sticky top-2 z-10" style={{ borderColor: "var(--accent)" }}>
            <span className="text-[13px] font-medium mr-2" style={{ color: "var(--text)" }}>{sel.size} selected</span>
            <Button size="sm" onClick={() => setHide(Array.from(sel))}><EyeOff size={12} /> Hide</Button>
            <Button size="sm" onClick={() => bulk(Array.from(sel), "unhide")}><Eye size={12} /> Unhide</Button>
            <Button size="sm" onClick={() => bulk(Array.from(sel), "feature")}><Star size={12} /> Feature</Button>
            <Button size="sm" variant="danger" onClick={() => setDel(Array.from(sel))}><Trash2 size={12} /> Delete</Button>
            <Button size="sm" variant="ghost" onClick={() => setSel(new Set())}>Clear</Button>
          </div>
        )}

        {loading && !data ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="card h-64 pulse-lime" />)}</div>
        ) : data && data.items.length === 0 ? (
          <div className="card py-16 text-center text-[13px]" style={{ color: "var(--text-muted)" }}>Nothing here. 🎉</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {data?.items.map((g) => (
              <div key={g.id} className="card overflow-hidden flex flex-col" style={sel.has(g.id) ? { borderColor: "var(--accent)" } : undefined}>
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={resolveImageUrl(g.image_url)} alt={g.image_title} className="w-full h-44 object-cover" style={{ opacity: g.is_hidden ? 0.35 : 1 }} />
                  <input type="checkbox" checked={sel.has(g.id)} onChange={() => toggle(g.id)} className="absolute top-2 left-2 w-4 h-4" aria-label="Select post" />
                  <div className="absolute top-2 right-2 flex gap-1">
                    {g.is_featured && <Badge variant="accent">★ Featured</Badge>}
                    {g.is_hidden && <Badge variant="danger">Hidden</Badge>}
                    {g.remix_of && <Badge variant="warning"><GitMerge size={10} className="mr-1" />Remix</Badge>}
                  </div>
                </div>
                <div className="p-4 flex-1 flex flex-col gap-2">
                  <p className="text-[14px] font-medium leading-snug" style={{ color: "var(--text)" }}>{g.caption}</p>
                  <div className="text-[11px] flex flex-wrap items-center gap-x-2" style={{ color: "var(--text-muted)" }}>
                    <Link href={`/dashboard/moderation?user=${g.user_id}`} className="hover:underline">{g.creator_name}</Link>·<span>{timeAgo(g.created_at)}</span>·
                    <span style={{ color: "var(--success)" }}>{g.lols} LOL</span><span style={{ color: "var(--danger)" }}>{g.nahs} NAH</span>
                  </div>
                  {g.is_hidden && g.hidden_reason && <div className="text-[11px]" style={{ color: "var(--danger)" }}>Reason: {g.hidden_reason}</div>}
                  <div className="flex flex-wrap gap-1">{g.tags.slice(0, 4).map((t) => <Badge key={t}>{t}</Badge>)}</div>
                  <div className="flex items-center gap-1 mt-auto pt-2">
                    {g.is_hidden
                      ? <Button size="sm" onClick={() => bulk([g.id], "unhide")}><Eye size={12} /> Unhide</Button>
                      : <Button size="sm" onClick={() => setHide([g.id])}><EyeOff size={12} /> Hide</Button>}
                    <Button size="sm" variant="ghost" title={g.is_featured ? "Unfeature" : "Feature"} onClick={() => bulk([g.id], g.is_featured ? "unfeature" : "feature")}><Star size={13} fill={g.is_featured ? "currentColor" : "none"} /></Button>
                    <Button size="sm" variant="ghost" title="Edit caption" onClick={() => setEdit(g)}><Pencil size={13} /></Button>
                    {can("studio.use") && <Link href={`/dashboard/studio?remix=${g.id}`} title="Remix in Studio"><Button size="sm" variant="ghost"><Wand2 size={13} /></Button></Link>}
                    <Button size="sm" variant="danger" className="ml-auto" title="Delete" onClick={() => setDel([g.id])}><Trash2 size={13} /></Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {data && totalPages > 1 && (
          <div className="flex items-center justify-center gap-3">
            <Button size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft size={13} /></Button>
            <span className="text-[13px]" style={{ color: "var(--text-muted)" }}>Page {page + 1} of {totalPages}</span>
            <Button size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage(page + 1)}><ChevronRight size={13} /></Button>
          </div>
        )}
      </div>

      <HideModal ids={hide} onClose={() => setHide(null)} onConfirm={(reason) => hide && bulk(hide, "hide", reason)} />
      <EditModal item={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />
      <Modal open={!!del} onClose={() => setDel(null)} title="Delete permanently?" size="sm"
        footer={<><Button variant="ghost" onClick={() => setDel(null)}>Cancel</Button><Button variant="danger" onClick={() => del && bulk(del, "delete")}><Trash2 size={13} /> Delete {del?.length}</Button></>}>
        <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>This removes {del?.length} post(s) along with their votes. Remixes of them are kept but detached. If you only want it off the feed, <b>hide</b> it instead — that&apos;s reversible.</p>
      </Modal>
    </div>
  );
}

function HideModal({ ids, onClose, onConfirm }: { ids: string[] | null; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  useEffect(() => setReason(""), [ids]);
  return (
    <Modal open={!!ids} onClose={onClose} title={`Hide ${ids?.length ?? 0} post${ids?.length === 1 ? "" : "s"}`} size="sm"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => onConfirm(reason)}><EyeOff size={13} /> Hide</Button></>}>
      <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Hidden posts stay in the database and can be restored. The main app must filter on <code>is_hidden</code> (see README).</p>
      <Field label="Reason (internal)"><input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="Off-topic, harassment, duplicate…" className="w-full px-3 py-2 rounded-lg text-[13px] outline-none" style={inputStyle} /></Field>
    </Modal>
  );
}

function EditModal({ item, onClose, onSaved }: { item: Item | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [caption, setCaption] = useState("");
  const [tone, setTone] = useState("");
  const [options, setOptions] = useState<string[]>([]);
  const [busy, setBusy] = useState<"save" | "ai" | null>(null);
  useEffect(() => { setCaption(item?.caption ?? ""); setOptions([]); setTone(""); }, [item]);
  if (!item) return null;

  async function suggest() {
    setBusy("ai");
    try {
      const r = await api<{ captions: string[] }>("/api/admin/studio/caption", { method: "POST", body: { image_url: item!.image_url, tags: item!.tags, tone, count: 3, avoid: [item!.caption] } });
      setOptions(r.captions);
    } catch (e) { toast.error(e instanceof Error ? e.message : "AI failed"); }
    finally { setBusy(null); }
  }
  async function save() {
    setBusy("save");
    try { await api(`/api/admin/media/generations/${item!.id}`, { method: "PATCH", body: { caption } }); toast.success("Caption updated"); onSaved(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(null); }
  }

  return (
    <Modal open onClose={onClose} title="Edit caption"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!!busy || !caption.trim() || caption === item.caption} onClick={save}>{busy === "save" ? "Saving…" : "Save caption"}</Button></>}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={resolveImageUrl(item.image_url)} alt="" className="w-full h-40 object-cover rounded-lg" />
      <Field label={`Caption (${caption.length}/400)`}>
        <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={3} maxLength={400} className="w-full px-3 py-2 rounded-lg text-[13px] outline-none resize-none" style={inputStyle} />
      </Field>
      <div className="flex items-center gap-2">
        <select value={tone} onChange={(e) => setTone(e.target.value)} className="px-3 py-2 rounded-lg text-[13px] outline-none" style={inputStyle}>
          <option value="">Any tone</option>{Object.keys(TONES).map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <Button size="sm" disabled={!!busy} onClick={suggest}><Sparkles size={12} className={busy === "ai" ? "animate-pulse" : ""} />{busy === "ai" ? "Thinking…" : "Suggest with AI"}</Button>
      </div>
      {options.map((o) => (
        <button key={o} onClick={() => setCaption(o)} className="w-full text-left text-[13px] px-3 py-2 rounded-lg" style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }}>{o}</button>
      ))}
    </Modal>
  );
}

export default function ModerationPage() {
  return <Suspense fallback={null}><ModerationInner /></Suspense>;
}
