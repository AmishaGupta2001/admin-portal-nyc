"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { RefreshCw, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { RoleBadge } from "@/components/ui/RoleBadge";
import { inputStyle } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { api, timeAgo, downloadCsv } from "@/lib/api";
import type { Role } from "@/lib/roles";

interface Entry { id: string; created_at: string; actor_email: string; actor_role: Role; action: string; target_type: string | null; target_id: string | null; metadata: Record<string, unknown> }
const GROUPS = ["user", "post", "image", "tag", "vote", "studio"];

export default function AuditPage() {
  const toast = useToast();
  const [data, setData] = useState<{ items: Entry[]; total: number; page_size: number } | null>(null);
  const [page, setPage] = useState(0);
  const [group, setGroup] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page: String(page) });
      if (group) p.set("action", group);
      setData(await api(`/api/admin/audit?${p}`));
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, group]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => setPage(0), [group]);

  const variant = (a: string) => (/delete|ban|purge|hide/.test(a) && !/unban|unhide/.test(a) ? "danger" : /role|publish|create/.test(a) ? "accent" : "default") as "danger" | "accent" | "default";
  const pages = data ? Math.max(Math.ceil(data.total / data.page_size), 1) : 1;

  return (
    <div className="fade-in">
      <Header title="Audit log" subtitle={data ? `${data.total} recorded actions` : "Loading…"}
        action={<div className="flex gap-2">
          <Button size="sm" onClick={() => data && downloadCsv("audit-log.csv", data.items.map((e) => ({ time: e.created_at, actor: e.actor_email, role: e.actor_role, action: e.action, target: `${e.target_type ?? ""}:${e.target_id ?? ""}`, details: JSON.stringify(e.metadata) })))}>Export page</Button>
          <Button size="sm" onClick={load} disabled={loading}><RefreshCw size={13} className={loading ? "animate-spin" : ""} /></Button>
        </div>} />
      <div className="p-8 space-y-5">
        <select value={group} onChange={(e) => setGroup(e.target.value)} className="px-3 py-2 rounded-lg text-[13px] outline-none" style={inputStyle}>
          <option value="">All actions</option>{GROUPS.map((g) => <option key={g} value={g}>{g}.*</option>)}
        </select>
        <div className="card overflow-hidden">
          <table className="admin-table">
            <thead><tr><th style={{ width: 28 }} /><th>When</th><th>Who</th><th>Action</th><th>Target</th></tr></thead>
            <tbody>
              {loading && !data ? <tr><td colSpan={5} className="text-center py-12" style={{ color: "var(--text-muted)" }}>Loading…</td></tr>
                : data?.items.length === 0 ? <tr><td colSpan={5} className="text-center py-12" style={{ color: "var(--text-muted)" }}>Nothing logged yet. Actions you take in the panel appear here.</td></tr>
                : data?.items.map((e) => (
                  <Fragment key={e.id}>
                    <tr className="cursor-pointer" onClick={() => setOpen(open === e.id ? null : e.id)}>
                      <td><ChevronDown size={14} style={{ color: "var(--text-muted)", transform: open === e.id ? "rotate(180deg)" : undefined }} /></td>
                      <td style={{ color: "var(--text-muted)" }} title={new Date(e.created_at).toLocaleString()}>{timeAgo(e.created_at)}</td>
                      <td><div className="flex items-center gap-2"><span className="text-[13px]">{e.actor_email}</span><RoleBadge role={e.actor_role} /></div></td>
                      <td><Badge variant={variant(e.action)}>{e.action}</Badge></td>
                      <td style={{ color: "var(--text-muted)" }}>{e.target_type ?? "—"} {e.target_id ? <code className="text-[11px]">{e.target_id.slice(0, 8)}</code> : null}</td>
                    </tr>
                    {open === e.id && (
                      <tr><td colSpan={5}><pre className="text-[11px] p-3 rounded-lg overflow-x-auto" style={{ background: "var(--bg)", color: "var(--text-muted)" }}>{JSON.stringify({ target_id: e.target_id, ...e.metadata }, null, 2)}</pre></td></tr>
                    )}
                  </Fragment>
                ))}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className="flex items-center justify-center gap-3">
            <Button size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft size={13} /></Button>
            <span className="text-[13px]" style={{ color: "var(--text-muted)" }}>Page {page + 1} of {pages}</span>
            <Button size="sm" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}><ChevronRight size={13} /></Button>
          </div>
        )}
      </div>
    </div>
  );
}
