"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search, RefreshCw, UserPlus, Download, Ban, ShieldCheck, Copy, Trash2, Wand2, Save, ExternalLink } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { RoleBadge } from "@/components/ui/RoleBadge";
import { Modal, Field, inputStyle } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useMe } from "@/components/admin/MeProvider";
import { api, timeAgo, downloadCsv } from "@/lib/api";
import { resolveImageUrl } from "@/lib/url";
import { ROLES, ROLE_META, ROLE_RANK, Role } from "@/lib/roles";

interface UserRow {
  id: string; email: string; first_name: string | null; last_name: string | null; avatar_url: string | null;
  role: Role; is_banned: boolean; ban_reason: string | null; provider: string | null;
  created_at: string; last_seen: string | null; generation_count: number; vote_count: number;
}
interface Detail {
  user: UserRow & { banned_at: string | null };
  stats: { generations: number; hidden: number; votes_cast: number; lols_cast: number; lols_received: number; nahs_received: number };
  recent_generations: { id: string; caption: string; created_at: string; is_hidden: boolean; image_url: string }[];
  activity: { id: string; created_at: string; action: string; actor_email: string; metadata: any }[];
}

const fullName = (u: { first_name: string | null; last_name: string | null }) => [u.first_name, u.last_name].filter(Boolean).join(" ");

function UsersInner() {
  const toast = useToast();
  const { me, can } = useMe();
  const params = useSearchParams();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState("newest");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [banTarget, setBanTarget] = useState<string[] | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setUsers((await api<{ users: UserRow[] }>("/api/admin/users")).users); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed to load users"); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (params.get("invite") === "1") setShowInvite(true); }, [params]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const list = users.filter((u) =>
      (!q || u.email.toLowerCase().includes(q) || fullName(u).toLowerCase().includes(q) || u.id.startsWith(q)) &&
      (roleFilter === "all" || u.role === roleFilter) &&
      (statusFilter === "all" || (statusFilter === "banned" ? u.is_banned : !u.is_banned))
    );
    const by: Record<string, (a: UserRow, b: UserRow) => number> = {
      newest: (a, b) => +new Date(b.created_at) - +new Date(a.created_at),
      posts: (a, b) => b.generation_count - a.generation_count,
      votes: (a, b) => b.vote_count - a.vote_count,
      seen: (a, b) => +new Date(b.last_seen ?? 0) - +new Date(a.last_seen ?? 0),
    };
    return [...list].sort(by[sort]);
  }, [users, search, roleFilter, statusFilter, sort]);

  const staffCount = users.filter((u) => u.role !== "user").length;
  const bannedCount = users.filter((u) => u.is_banned).length;
  const active7 = users.filter((u) => u.last_seen && Date.now() - +new Date(u.last_seen) < 7 * 864e5).length;

  const canActOn = (u: UserRow) => !!me && u.id !== me.id && (me.role === "superadmin" || ROLE_RANK[me.role] > ROLE_RANK[u.role]);
  const allSelected = filtered.length > 0 && filtered.every((u) => selected.has(u.id));
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  async function bulkUnban() {
    const ids = Array.from(selected).filter((id) => users.find((u) => u.id === id)?.is_banned);
    let ok = 0;
    for (const id of ids) { try { await api(`/api/admin/users/${id}`, { method: "PATCH", body: { banned: false } }); ok++; } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); } }
    if (ok) toast.success(`Unbanned ${ok} user${ok > 1 ? "s" : ""}`);
    setSelected(new Set()); load();
  }

  const exportCsv = (rows: UserRow[]) =>
    downloadCsv(`nyc-unhinged-users-${new Date().toISOString().slice(0, 10)}.csv`, rows.map((u) => ({
      id: u.id, email: u.email, name: fullName(u), role: u.role, banned: u.is_banned,
      posts: u.generation_count, votes_cast: u.vote_count, joined: u.created_at, last_seen: u.last_seen ?? "",
    })));

  return (
    <div className="fade-in">
      <Header
        title="Users"
        subtitle={`${users.length} registered · ${staffCount} staff · ${bannedCount} banned`}
        action={
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={load} disabled={loading}><RefreshCw size={13} className={loading ? "animate-spin" : ""} /></Button>
            <Button size="sm" onClick={() => exportCsv(selected.size ? users.filter((u) => selected.has(u.id)) : filtered)} title="Export current view (or selection) as CSV">
              <Download size={13} /> Export
            </Button>
            {can("users.invite") && <Button variant="primary" size="sm" onClick={() => setShowInvite(true)}><UserPlus size={13} /> Add user</Button>}
          </div>
        }
      />

      <div className="p-8 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            ["Total users", users.length], ["Active in 7 days", active7], ["Staff", staffCount], ["Banned", bannedCount],
          ].map(([l, v]) => (
            <div key={l as string} className="card px-4 py-3">
              <div className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: "var(--text-muted)" }}>{l}</div>
              <div className="stat-number text-2xl mt-1" style={{ color: "var(--text)" }}>{v}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email or id…" className="w-full pl-9 pr-4 py-2 rounded-lg text-[13px] outline-none" style={inputStyle} />
          </div>
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="px-3 py-2 rounded-lg text-[13px] outline-none" style={inputStyle}>
            <option value="all">All roles</option>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_META[r].label}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 rounded-lg text-[13px] outline-none" style={inputStyle}>
            <option value="all">Any status</option><option value="active">Active</option><option value="banned">Banned</option>
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="px-3 py-2 rounded-lg text-[13px] outline-none" style={inputStyle}>
            <option value="newest">Newest first</option><option value="seen">Recently active</option><option value="posts">Most posts</option><option value="votes">Most votes cast</option>
          </select>
        </div>

        {selected.size > 0 && (
          <div className="card px-4 py-2.5 flex items-center gap-3 fade-in" style={{ borderColor: "var(--accent)" }}>
            <span className="text-[13px] font-medium" style={{ color: "var(--text)" }}>{selected.size} selected</span>
            {can("users.edit") && (
              <>
                <Button size="sm" variant="danger" onClick={() => setBanTarget(Array.from(selected).filter((id) => { const u = users.find((x) => x.id === id); return !!u && !u.is_banned && canActOn(u); }))}><Ban size={12} /> Ban</Button>
                <Button size="sm" onClick={bulkUnban}><ShieldCheck size={12} /> Unban</Button>
              </>
            )}
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
          </div>
        )}

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: 36 }}><input type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(filtered.map((u) => u.id)))} aria-label="Select all" /></th>
                  <th>User</th><th>Role</th><th>Status</th><th>Posts</th><th>Votes</th><th>Last seen</th><th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="text-center py-12" style={{ color: "var(--text-muted)" }}>Loading users…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-12" style={{ color: "var(--text-muted)" }}>No users match</td></tr>
                ) : filtered.map((u) => (
                  <tr key={u.id} className="cursor-pointer" onClick={() => setOpenId(u.id)}>
                    <td onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selected.has(u.id)} onChange={() => toggle(u.id)} aria-label="Select user" /></td>
                    <td>
                      <div className="flex items-center gap-3">
                        <Avatar src={resolveImageUrl(u.avatar_url)} name={fullName(u) || u.email} />
                        <div className="min-w-0">
                          <div className="text-[13px] font-medium truncate" style={{ color: "var(--text)" }}>{fullName(u) || "—"}</div>
                          <div className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td><RoleBadge role={u.role} /></td>
                    <td>{u.is_banned ? <Badge variant="danger">Banned</Badge> : <Badge variant="success">Active</Badge>}</td>
                    <td><span className="stat-number text-[14px]">{u.generation_count}</span></td>
                    <td><span className="stat-number text-[14px]">{u.vote_count}</span></td>
                    <td style={{ color: "var(--text-muted)" }}>{timeAgo(u.last_seen)}</td>
                    <td style={{ color: "var(--text-muted)" }}>{new Date(u.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {openId && <UserDrawer id={openId} onClose={() => setOpenId(null)} onChanged={load} />}
      <InviteModal open={showInvite} onClose={() => setShowInvite(false)} onDone={load} />
      <BanModal ids={banTarget} onClose={() => setBanTarget(null)} onDone={() => { setSelected(new Set()); load(); }} />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function BanModal({ ids, onClose, onDone }: { ids: string[] | null; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => setReason(""), [ids]);
  if (!ids) return null;

  async function run() {
    setBusy(true);
    let ok = 0;
    for (const id of ids!) {
      try { await api(`/api/admin/users/${id}`, { method: "PATCH", body: { banned: true, reason } }); ok++; }
      catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    }
    setBusy(false);
    if (ok) toast.success(`Banned ${ok} user${ok > 1 ? "s" : ""}`);
    onClose(); onDone();
  }

  return (
    <Modal open onClose={onClose} title={`Ban ${ids.length} user${ids.length === 1 ? "" : "s"}`} size="sm"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="danger" disabled={busy || !ids.length} onClick={run}><Ban size={13} />{busy ? "Banning…" : "Ban"}</Button></>}>
      {ids.length === 0 ? <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>None of the selected users can be banned by you.</p> : (
        <>
          <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>They&apos;ll be signed out of the app and blocked from signing in until unbanned. Their posts are kept.</p>
          <Field label="Reason (shown only to admins)"><input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="Spam, harassment, …" className="w-full px-3 py-2 rounded-lg text-[13px] outline-none" style={inputStyle} /></Field>
        </>
      )}
    </Modal>
  );
}

function InviteModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const { me } = useMe();
  const [f, setF] = useState({ email: "", first_name: "", last_name: "", role: "user" as Role });
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await api("/api/admin/users", { method: "POST", body: f });
      toast.success(`Created ${f.email}`);
      setF({ email: "", first_name: "", last_name: "", role: "user" });
      onClose(); onDone();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add a user"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={busy || !f.email} onClick={save}><UserPlus size={13} />{busy ? "Creating…" : "Create user"}</Button></>}>
      <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
        Pre-creates a confirmed account. When this person signs in with Google using the same email, they land on this account with the role you pick.
      </p>
      <Field label="Email"><input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className="w-full px-3 py-2 rounded-lg text-[13px] outline-none" style={inputStyle} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name"><input value={f.first_name} onChange={(e) => setF({ ...f, first_name: e.target.value })} className="w-full px-3 py-2 rounded-lg text-[13px] outline-none" style={inputStyle} /></Field>
        <Field label="Last name"><input value={f.last_name} onChange={(e) => setF({ ...f, last_name: e.target.value })} className="w-full px-3 py-2 rounded-lg text-[13px] outline-none" style={inputStyle} /></Field>
      </div>
      <Field label="Role" hint={ROLE_META[f.role].blurb}>
        <select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })} disabled={me?.role !== "superadmin"} className="w-full px-3 py-2 rounded-lg text-[13px] outline-none" style={inputStyle}>
          {ROLES.map((r) => <option key={r} value={r}>{ROLE_META[r].label}</option>)}
        </select>
      </Field>
    </Modal>
  );
}

function UserDrawer({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const { me, can } = useMe();
  const [d, setD] = useState<Detail | null>(null);
  const [name, setName] = useState({ first_name: "", last_name: "" });
  const [reason, setReason] = useState("");
  const [confirmDelete, setConfirmDelete] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api<Detail>(`/api/admin/users/${id}`);
      setD(r); setName({ first_name: r.user.first_name ?? "", last_name: r.user.last_name ?? "" });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); onClose(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function patch(body: Record<string, unknown>, msg: string) {
    setBusy(true);
    try { await api(`/api/admin/users/${id}`, { method: "PATCH", body }); toast.success(msg); await load(); onChanged(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  async function del() {
    setBusy(true);
    try {
      const r = await api<{ generations_removed: number }>(`/api/admin/users/${id}`, { method: "DELETE" });
      toast.success(`User deleted (${r.generations_removed} posts removed)`); onClose(); onChanged();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); setBusy(false); }
  }

  if (!d) return <Modal open onClose={onClose} title="Loading…" size="lg"><div className="py-16 text-center text-[13px]" style={{ color: "var(--text-muted)" }}>Loading user…</div></Modal>;

  const u = d.user;
  const isSelf = me?.id === u.id;
  const outranks = !!me && !isSelf && (me.role === "superadmin" || ROLE_RANK[me.role] > ROLE_RANK[u.role]);
  const nameDirty = name.first_name !== (u.first_name ?? "") || name.last_name !== (u.last_name ?? "");

  return (
    <Modal open onClose={onClose} title="User profile" size="lg">
      <div className="flex items-center gap-4">
        <Avatar src={resolveImageUrl(u.avatar_url)} name={fullName(u) || u.email} size={56} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[16px] font-semibold" style={{ color: "var(--text)" }}>{fullName(u) || "Unnamed user"}</span>
            <RoleBadge role={u.role} />{u.is_banned && <Badge variant="danger">Banned</Badge>}{isSelf && <Badge variant="muted">You</Badge>}
          </div>
          <div className="text-[12px]" style={{ color: "var(--text-muted)" }}>{u.email} · {u.provider ?? "unknown provider"}</div>
          <button className="text-[11px] inline-flex items-center gap-1 mt-0.5" style={{ color: "var(--text-muted)" }} onClick={() => { navigator.clipboard.writeText(u.id); toast.info("User id copied"); }}>
            <Copy size={10} /> {u.id}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[["Posts", d.stats.generations], ["Votes cast", d.stats.votes_cast], ["LOLs received", d.stats.lols_received], ["NAHs received", d.stats.nahs_received], ["Hidden posts", d.stats.hidden], ["Joined", new Date(u.created_at).toLocaleDateString()]].map(([l, v]) => (
          <div key={l as string} className="rounded-lg px-3 py-2" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
            <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "var(--text-muted)" }}>{l}</div>
            <div className="stat-number text-lg">{v}</div>
          </div>
        ))}
      </div>
      <div className="text-[12px]" style={{ color: "var(--text-muted)" }}>Last seen {timeAgo(u.last_seen)}{u.is_banned && u.ban_reason ? ` · Ban reason: ${u.ban_reason}` : ""}</div>

      {/* Edit */}
      {(can("users.edit") && outranks) || isSelf ? (
        <section className="space-y-3">
          <h3 className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Profile</h3>
          <div className="grid grid-cols-2 gap-3">
            <input value={name.first_name} onChange={(e) => setName({ ...name, first_name: e.target.value })} placeholder="First name" className="px-3 py-2 rounded-lg text-[13px] outline-none" style={inputStyle} />
            <input value={name.last_name} onChange={(e) => setName({ ...name, last_name: e.target.value })} placeholder="Last name" className="px-3 py-2 rounded-lg text-[13px] outline-none" style={inputStyle} />
          </div>
          <Button size="sm" variant="primary" disabled={busy || !nameDirty} onClick={() => patch(name, "Profile updated")}><Save size={12} /> Save name</Button>
        </section>
      ) : null}

      {/* Role */}
      {can("users.assign_role") && (
        <section className="space-y-2">
          <h3 className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Role</h3>
          <div className="grid grid-cols-2 gap-2">
            {ROLES.map((r) => (
              <button key={r} disabled={busy || isSelf || r === u.role} onClick={() => patch({ role: r }, `Role set to ${ROLE_META[r].label}`)}
                className="text-left rounded-lg px-3 py-2 disabled:cursor-not-allowed transition-colors"
                style={{ background: r === u.role ? "rgba(180,255,71,0.12)" : "var(--bg)", border: `1px solid ${r === u.role ? "var(--accent)" : "var(--border)"}`, opacity: isSelf && r !== u.role ? 0.5 : 1 }}>
                <div className="text-[13px] font-medium" style={{ color: "var(--text)" }}>{ROLE_META[r].label}{r === u.role && " ✓"}</div>
                <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>{ROLE_META[r].blurb}</div>
              </button>
            ))}
          </div>
          {isSelf && <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>You can&apos;t change your own role.</p>}
        </section>
      )}

      {/* Ban */}
      {can("users.edit") && outranks && u.role !== "superadmin" && (can("users.ban_staff") || u.role === "user") && (
        <section className="space-y-2">
          <h3 className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Access</h3>
          {u.is_banned ? (
            <Button size="sm" disabled={busy} onClick={() => patch({ banned: false }, "User unbanned")}><ShieldCheck size={12} /> Unban user</Button>
          ) : (
            <div className="flex gap-2">
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" maxLength={300} className="flex-1 px-3 py-2 rounded-lg text-[13px] outline-none" style={inputStyle} />
              <Button size="sm" variant="danger" disabled={busy} onClick={() => patch({ banned: true, reason }, "User banned")}><Ban size={12} /> Ban</Button>
            </div>
          )}
        </section>
      )}

      {/* Quick actions */}
      <section className="flex flex-wrap gap-2">
        {can("studio.post_as_other") && !u.is_banned && <Link href={`/dashboard/studio?user=${u.id}`} onClick={onClose}><Button size="sm"><Wand2 size={12} /> Post as this user</Button></Link>}
        {can("content.moderate") && <Link href={`/dashboard/moderation?user=${u.id}`} onClick={onClose}><Button size="sm"><ExternalLink size={12} /> Their posts</Button></Link>}
      </section>

      {d.recent_generations.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Recent posts</h3>
          <div className="grid grid-cols-4 gap-2">
            {d.recent_generations.map((g) => (
              <div key={g.id} className="rounded-lg overflow-hidden relative" style={{ border: "1px solid var(--border)" }} title={g.caption}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={resolveImageUrl(g.image_url)} alt="" className="w-full h-20 object-cover" style={{ opacity: g.is_hidden ? 0.35 : 1 }} />
                <div className="text-[10px] px-1.5 py-1 truncate" style={{ color: "var(--text-muted)" }}>{g.caption}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {d.activity.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Admin activity on this user</h3>
          {d.activity.map((a) => (
            <div key={a.id} className="text-[12px] flex justify-between gap-3" style={{ color: "var(--text-muted)" }}>
              <span><code style={{ color: "var(--text)" }}>{a.action}</code> by {a.actor_email}</span><span>{timeAgo(a.created_at)}</span>
            </div>
          ))}
        </section>
      )}

      {can("users.delete") && outranks && u.role !== "superadmin" && (
        <section className="rounded-lg p-3 space-y-2" style={{ border: "1px solid rgba(255,85,85,0.3)", background: "rgba(255,85,85,0.05)" }}>
          <h3 className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--danger)" }}>Danger zone</h3>
          <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Permanently deletes the account, their {d.stats.generations} posts, and all votes they cast. Type their email to confirm.</p>
          <div className="flex gap-2">
            <input value={confirmDelete} onChange={(e) => setConfirmDelete(e.target.value)} placeholder={u.email} className="flex-1 px-3 py-2 rounded-lg text-[13px] outline-none" style={inputStyle} />
            <Button size="sm" variant="danger" disabled={busy || confirmDelete.toLowerCase() !== u.email.toLowerCase()} onClick={del}><Trash2 size={12} /> Delete</Button>
          </div>
        </section>
      )}
    </Modal>
  );
}

export default function UsersPage() {
  return <Suspense fallback={null}><UsersInner /></Suspense>;
}
