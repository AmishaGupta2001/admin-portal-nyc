"use client";

import { useEffect, useState } from "react";
import { RefreshCw, ThumbsUp, ThumbsDown, Search } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { resolveImageUrl } from "@/lib/url";
import { StatCard } from "@/components/ui/StatCard";

interface VoteRow {
  id: string;
  vote: 1 | -1;
  voter_name: string;
  caption: string;
  image_url: string;
  created_at: string;
}

interface VoteStats {
  totalVotes: number;
  totalLols: number;
  totalNahs: number;
  topVotedGenerations: { caption: string; creator_name: string; score: number }[];
  mostControversial: { caption: string; creator_name: string; score: number; total: number }[];
  votes: VoteRow[];
}

export default function VotesPage() {
  const [data, setData] = useState<VoteStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "lol" | "nah">("all");

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/votes");
      const json = await res.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filteredVotes = (data?.votes ?? []).filter((v) => {
    const matchSearch =
      v.caption.toLowerCase().includes(search.toLowerCase()) ||
      v.voter_name.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === "all" || (filter === "lol" && v.vote === 1) || (filter === "nah" && v.vote === -1);
    return matchSearch && matchFilter;
  });

  return (
    <div className="fade-in">
      <Header
        title="Votes & Ratings"
        subtitle="Read-only view of all votes cast"
        action={
          <Button variant="secondary" size="sm" onClick={load} disabled={loading}>
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Refresh
          </Button>
        }
      />

      <div className="p-8 space-y-8">
        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Votes" value={loading ? "—" : data?.totalVotes ?? 0} accent />
          <StatCard
            label="LOLs 😂"
            value={loading ? "—" : data?.totalLols ?? 0}
            sub="Upvotes"
            icon={ThumbsUp}
          />
          <StatCard
            label="Nahs 😒"
            value={loading ? "—" : data?.totalNahs ?? 0}
            sub="Downvotes"
            icon={ThumbsDown}
          />
          <StatCard
            label="Approval Rate"
            value={
              loading
                ? "—"
                : data && (data.totalLols + data.totalNahs) > 0
                ? `${Math.round((data.totalLols / (data.totalLols + data.totalNahs)) * 100)}%`
                : "—"
            }
            sub="LOL / (LOL + Nah)"
          />
        </div>

        {/* Most controversial */}
        {data?.mostControversial && data.mostControversial.length > 0 && (
          <div className="card p-5">
            <h3 className="text-[13px] font-semibold mb-4" style={{ color: "var(--text)" }}>
              🌶️ Most Controversial
              <span className="ml-2 text-[11px] font-normal" style={{ color: "var(--text-muted)" }}>
                Highest total votes with near-zero net score
              </span>
            </h3>
            <div className="space-y-2">
              {data.mostControversial.slice(0, 5).map((g, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 rounded-lg"
                  style={{ background: "var(--bg-card-hover)" }}
                >
                  <div>
                    <div className="text-[13px] font-medium" style={{ color: "var(--text)" }}>{g.caption}</div>
                    <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>by {g.creator_name}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="warning">{g.total} votes</Badge>
                    <Badge variant={g.score === 0 ? "muted" : g.score > 0 ? "success" : "danger"}>
                      net {g.score > 0 ? "+" : ""}{g.score}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Vote feed */}
        <div>
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="relative flex-1 max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
              <input
                type="text"
                placeholder="Search votes…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-lg text-[13px] outline-none"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text)" }}
              />
            </div>
            <div className="flex gap-1 p-1 rounded-xl" style={{ background: "var(--bg-card)" }}>
              {(["all", "lol", "nah"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className="px-3 py-1 rounded-lg text-[12px] font-medium capitalize transition-all"
                  style={
                    filter === f
                      ? { background: "var(--accent)", color: "var(--accent-fg)" }
                      : { color: "var(--text-muted)" }
                  }
                >
                  {f === "lol" ? "😂 LOLs" : f === "nah" ? "😒 Nahs" : "All"}
                </button>
              ))}
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Generation</th>
                    <th>Voter</th>
                    <th>Vote</th>
                    <th>Cast</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={4} className="text-center py-12" style={{ color: "var(--text-muted)" }}>Loading…</td></tr>
                  ) : filteredVotes.length === 0 ? (
                    <tr><td colSpan={4} className="text-center py-12" style={{ color: "var(--text-muted)" }}>No votes found</td></tr>
                  ) : (
                    filteredVotes.slice(0, 100).map((v) => (
                      <tr key={v.id}>
                        <td>
                          <div className="flex items-center gap-3">
                            {v.image_url && (
                              <img
                                src={resolveImageUrl(v.image_url)}
                                alt=""
                                className="w-8 h-8 rounded object-cover flex-shrink-0"
                                style={{ border: "1px solid var(--border)" }}
                                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                              />
                            )}
                            <span className="text-[13px] max-w-xs truncate" style={{ color: "var(--text)" }}>
                              {v.caption}
                            </span>
                          </div>
                        </td>
                        <td style={{ color: "var(--text-muted)" }}>{v.voter_name}</td>
                        <td>
                          {v.vote === 1 ? (
                            <Badge variant="success">😂 LOL</Badge>
                          ) : (
                            <Badge variant="danger">😒 Nah</Badge>
                          )}
                        </td>
                        <td style={{ color: "var(--text-muted)" }}>
                          {new Date(v.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
