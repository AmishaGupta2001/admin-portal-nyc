"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, CheckCircle2, XCircle, Zap } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";

interface Sys {
  env: Record<string, boolean>;
  schema: { table: string; column: string; ok: boolean; error?: string }[];
  rpc_email_lookup: boolean;
  bucket: { ok: boolean; public?: boolean; error?: string };
  counts: Record<string, number | null>;
  gemini_model: string;
}

const Row = ({ ok, label, detail }: { ok: boolean; label: string; detail?: string }) => (
  <div className="flex items-start gap-2.5 py-1.5">
    {ok ? <CheckCircle2 size={15} className="mt-0.5 flex-shrink-0" style={{ color: "var(--success)" }} /> : <XCircle size={15} className="mt-0.5 flex-shrink-0" style={{ color: "var(--danger)" }} />}
    <div><div className="text-[13px]" style={{ color: "var(--text)" }}>{label}</div>{detail && <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>{detail}</div>}</div>
  </div>
);

export default function SystemPage() {
  const toast = useToast();
  const [s, setS] = useState<Sys | null>(null);
  const [loading, setLoading] = useState(true);
  const [pinging, setPinging] = useState(false);
  const [ping, setPing] = useState<{ ok: boolean; ms: number; error?: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setS(await api("/api/admin/system")); } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { load(); }, [load]);

  async function testGemini() {
    setPinging(true);
    try { setPing(await api("/api/admin/system", { method: "POST" })); } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setPinging(false); }
  }

  const missing = s?.schema.filter((c) => !c.ok) ?? [];

  return (
    <div className="fade-in">
      <Header title="System" subtitle="Setup checker and health" action={<Button size="sm" onClick={load} disabled={loading}><RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Recheck</Button>} />
      <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {missing.length > 0 && (
          <div className="lg:col-span-2 card p-4" style={{ borderColor: "var(--danger)" }}>
            <p className="text-[13px] font-medium" style={{ color: "var(--danger)" }}>Database is missing {missing.length} column(s)/table(s). Apply the admin migrations and <code>../designingforgenai/supabase/migrations/20261028000000_week7_admin_observability.sql</code> to the shared Supabase project.</p>
          </div>
        )}
        <section className="card p-5">
          <h2 className="text-[12px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Environment</h2>
          {s && (Object.entries(s.env) as [string, boolean][]).map(([k, v]) => <Row key={k} ok={v} label={k} detail={!v && k === "NEXT_MAIN_APP_URL" ? "Needed to display & caption curated images stored as relative paths" : undefined} />)}
        </section>
        <section className="card p-5">
          <h2 className="text-[12px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Database & storage</h2>
          {s && (
            <>
              {s.schema.map((c) => <Row key={c.table + c.column} ok={c.ok} label={`${c.table}.${c.column}`} detail={c.error} />)}
              <Row ok={s.rpc_email_lookup} label="admin_user_id_by_email() function" detail={s.rpc_email_lookup ? undefined : "Missing — sign-in falls back to a slower user scan"} />
              <Row ok={s.bucket.ok} label="Storage bucket: generation-images" detail={s.bucket.ok ? (s.bucket.public ? "Public" : "Private — uploaded images won't render for visitors; make it public") : s.bucket.error} />
            </>
          )}
        </section>
        <section className="card p-5">
          <h2 className="text-[12px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Gemini</h2>
          <p className="text-[13px] mb-3" style={{ color: "var(--text-muted)" }}>Model: <code>{s?.gemini_model}</code></p>
          <Button size="sm" variant="primary" onClick={testGemini} disabled={pinging}><Zap size={12} /> {pinging ? "Testing…" : "Test connection"}</Button>
          {ping && <div className="mt-3"><Row ok={ping.ok} label={ping.ok ? `Responded in ${ping.ms}ms` : "Failed"} detail={ping.error} /></div>}
        </section>
        <section className="card p-5">
          <h2 className="text-[12px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Row counts</h2>
          {s && (Object.entries(s.counts) as [string, number | null][]).map(([t, n]) => (
            <div key={t} className="flex justify-between py-1.5 text-[13px]"><code style={{ color: "var(--text)" }}>{t}</code><span className="stat-number" style={{ color: n === null ? "var(--danger)" : "var(--text)" }}>{n === null ? "error" : n.toLocaleString()}</span></div>
          ))}
        </section>
      </div>
    </div>
  );
}
