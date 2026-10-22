"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { inputStyle } from "@/components/ui/Modal";
import { resolveImageUrl } from "@/lib/url";

export interface PickerUser { id: string; email: string; first_name: string | null; last_name: string | null; avatar_url: string | null; is_banned?: boolean }
const label = (u: PickerUser) => [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email;

export function UserPicker({ users, value, onChange, disabled }: { users: PickerUser[]; value: string; onChange: (id: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const current = users.find((u) => u.id === value);
  const list = useMemo(() => {
    const s = q.toLowerCase();
    return users.filter((u) => !u.is_banned && (!s || label(u).toLowerCase().includes(s) || u.email.toLowerCase().includes(s))).slice(0, 8);
  }, [users, q]);

  return (
    <div className="relative">
      <button type="button" disabled={disabled} onClick={() => setOpen(!open)} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-left disabled:opacity-60" style={inputStyle}>
        {current ? <><Avatar src={resolveImageUrl(current.avatar_url)} name={label(current)} size={22} /><span className="truncate">{label(current)}</span><span className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{current.email}</span></> : <span style={{ color: "var(--text-muted)" }}>Pick a user…</span>}
        <ChevronDown size={14} className="ml-auto flex-shrink-0" style={{ color: "var(--text-muted)" }} />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full card p-2 shadow-xl">
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search users…" className="w-full px-3 py-1.5 mb-1 rounded-md text-[12px] outline-none" style={inputStyle} />
          {list.map((u) => (
            <button key={u.id} onClick={() => { onChange(u.id); setOpen(false); setQ(""); }} className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[13px] text-left hover:bg-[var(--bg-card-hover)]" style={{ color: "var(--text)" }}>
              <Avatar src={resolveImageUrl(u.avatar_url)} name={label(u)} size={22} /><span className="truncate">{label(u)}</span>
              <span className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{u.email}</span>
            </button>
          ))}
          {list.length === 0 && <p className="text-[12px] text-center py-3" style={{ color: "var(--text-muted)" }}>No matches</p>}
        </div>
      )}
    </div>
  );
}
