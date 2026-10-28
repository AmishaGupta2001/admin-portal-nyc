"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw, ScanSearch, Trash2, AlertTriangle } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useMe } from "@/components/admin/MeProvider";
import { api } from "@/lib/api";

interface Suspect { user_id: string; name: string; total_votes: number; reasons: string[]; score: number }

export default function IntegrityPage() {
  const toast = useToast();
  const { can } = useMe();
  const [data, setData] = useState<{ analysed_votes: number; suspects: Suspect[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [purge, setPurge] = useState<Suspect | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await api("/api/admin/integrity")); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { load(); }, [load]);

  async function doPurge(s: Suspect) {
    try { const r = await api<{ removed: number }>("/api/admin/integrity", { method: "POST", body: { user_id: s.user_id } }); toast.success(`Removed ${r.removed} votes`); setPurge(null); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  return (
    <div className="fade-in">
      <Header title="Vote integrity" subtitle={data ? `Scanned ${data.analysed_votes.toLocaleString()} votes` : "Scanning…"} action={<Button size="sm" onClick={load} disabled={loading}><RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Rescan</Button>} />
      <div className="p-8 space-y-5">
        <div className="card p-4 flex gap-3 items-start" style={{ borderColor: "rgba(255,170,51,0.4)" }}>
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" style={{ color: "var(--warning)" }} />
          <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>These are <b>leads, not verdicts</b>. Heuristics: vote bursts (12+ in a minute), one-creator concentration (80%+ of 6+ votes), self-votes, and 25+ votes all in one direction. Review the user before purging their votes or banning them.</p>
        </div>
        {loading && !data ? <div className="card h-40 pulse-lime" /> : data && data.suspects.length === 0 ? (
          <div className="card py-16 text-center" style={{ color: "var(--text-muted)" }}><ScanSearch size={28} className="mx-auto mb-3" /><p className="text-[13px]">No suspicious voting patterns found 🎉</p></div>
        ) : (
          <div className="card overflow-hidden">
            <table className="admin-table">
              <thead><tr><th>Voter</th><th>Signals</th><th>Votes</th><th>Score</th><th>Actions</th></tr></thead>
              <tbody>
                {data?.suspects.map((s) => (
                  <tr key={s.user_id}>
                    <td className="font-medium" style={{ color: "var(--text)" }}>{s.name}<div className="text-[11px] font-normal" style={{ color: "var(--text-muted)" }}>{s.user_id.slice(0, 8)}…</div></td>
                    <td><div className="flex flex-wrap gap-1">{s.reasons.map((r) => <Badge key={r} variant="warning">{r}</Badge>)}</div></td>
                    <td><span className="stat-number">{s.total_votes}</span></td>
                    <td><Badge variant={s.score > 30 ? "danger" : "warning"}>{s.score}</Badge></td>
                    <td>
                      <div className="flex gap-2">
                        {can("users.view") && <Link href="/dashboard/users"><Button size="sm">Open users</Button></Link>}
                        <Button size="sm" variant="danger" onClick={() => setPurge(s)}><Trash2 size={12} /> Purge votes</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Modal open={!!purge} onClose={() => setPurge(null)} title="Purge all votes?" size="sm" footer={<><Button variant="ghost" onClick={() => setPurge(null)}>Cancel</Button><Button variant="danger" onClick={() => purge && doPurge(purge)}><Trash2 size={13} /> Purge {purge?.total_votes}</Button></>}>
        <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>Deletes all {purge?.total_votes} votes cast by <b>{purge?.name}</b>. Their account stays active. This can&apos;t be undone.</p>
      </Modal>
    </div>
  );
}
