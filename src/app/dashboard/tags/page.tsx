"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, RefreshCw, Pencil, Trash2, Check, X } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal, inputStyle } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useMe } from "@/components/admin/MeProvider";
import { api } from "@/lib/api";

export default function TagsPage() {
  const toast = useToast();
  const { can } = useMe();
  const [tags, setTags] = useState<{ tag: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [del, setDel] = useState<string | null>(null);
  const writable = can("media.manage");

  const load = useCallback(async () => {
    setLoading(true);
    try { setTags((await api<{ tags: { tag: string; count: number }[] }>("/api/admin/tags")).tags); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { load(); }, [load]);

  async function rename(tag: string) {
    try {
      const exists = tags.some((t) => t.tag === value.trim().toLowerCase() && t.tag !== tag);
      const r = await api<{ images_updated: number }>("/api/admin/tags", { method: "POST", body: { action: "rename", tag, to: value } });
      toast.success(`${exists ? "Merged" : "Renamed"} on ${r.images_updated} image(s)`); setEditing(null); load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }
  async function remove(tag: string) {
    try {
      const r = await api<{ images_updated: number }>("/api/admin/tags", { method: "POST", body: { action: "delete", tag } });
      toast.success(`Removed from ${r.images_updated} image(s)`); setDel(null); load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  const list = tags.filter((t) => t.tag.includes(q.toLowerCase()));
  const max = Math.max(...tags.map((t) => t.count), 1);

  return (
    <div className="fade-in">
      <Header title="Tags" subtitle={`${tags.length} unique tags across all images`} action={<Button size="sm" onClick={load} disabled={loading}><RefreshCw size={13} className={loading ? "animate-spin" : ""} /></Button>} />
      <div className="p-8 space-y-5">
        <div className="relative max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter tags…" className="w-full pl-9 pr-4 py-2 rounded-lg text-[13px] outline-none" style={inputStyle} />
        </div>
        <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Rename a tag to the name of an existing one to <b>merge</b> them (e.g. “subway” + “mta” → “subway”). Changes apply to every image.</p>
        <div className="card overflow-hidden">
          <table className="admin-table">
            <thead><tr><th>Tag</th><th style={{ width: "40%" }}>Usage</th><th style={{ width: 120 }}>Images</th>{writable && <th style={{ width: 110 }}>Actions</th>}</tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={4} className="text-center py-12" style={{ color: "var(--text-muted)" }}>Loading…</td></tr>
                : list.length === 0 ? <tr><td colSpan={4} className="text-center py-12" style={{ color: "var(--text-muted)" }}>No tags</td></tr>
                : list.map((t) => (
                  <tr key={t.tag}>
                    <td>
                      {editing === t.tag ? (
                        <div className="flex items-center gap-2">
                          <input autoFocus value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && rename(t.tag)} className="px-2 py-1 rounded-md text-[13px] outline-none" style={inputStyle} />
                          <button onClick={() => rename(t.tag)} style={{ color: "var(--success)" }} aria-label="Save"><Check size={15} /></button>
                          <button onClick={() => setEditing(null)} style={{ color: "var(--text-muted)" }} aria-label="Cancel"><X size={15} /></button>
                        </div>
                      ) : <Badge>{t.tag}</Badge>}
                    </td>
                    <td><div className="h-2 rounded-full" style={{ background: "var(--bg)" }}><div className="h-2 rounded-full" style={{ width: `${(t.count / max) * 100}%`, background: "var(--accent)" }} /></div></td>
                    <td><span className="stat-number text-[14px]">{t.count}</span></td>
                    {writable && (
                      <td>
                        <div className="flex gap-2">
                          <button onClick={() => { setEditing(t.tag); setValue(t.tag); }} style={{ color: "var(--text-muted)" }} title="Rename / merge"><Pencil size={14} /></button>
                          <button onClick={() => setDel(t.tag)} style={{ color: "var(--danger)" }} title="Delete from all images"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
      <Modal open={!!del} onClose={() => setDel(null)} title="Delete tag?" size="sm" footer={<><Button variant="ghost" onClick={() => setDel(null)}>Cancel</Button><Button variant="danger" onClick={() => del && remove(del)}><Trash2 size={13} /> Delete</Button></>}>
        <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>Removes “{del}” from every image that has it. The images themselves are untouched.</p>
      </Modal>
    </div>
  );
}
