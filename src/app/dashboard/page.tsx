"use client";

import { useEffect, useState } from "react";
import { Users, Image, ThumbsUp, Zap, TrendingUp, RefreshCw, GitMerge } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { resolveImageUrl } from "@/lib/url";

interface DashStats {
  totalUsers: number;
  totalGenerations: number;
  totalImages: number;
  totalVotes: number;
  totalLols: number;
  totalNahs: number;
  totalRemixes: number;
  recentGenerations: {
    id: string;
    caption: string;
    creator_name: string;
    vote_count: number;
    created_at: string;
    image_url: string;
  }[];
  topGenerations: {
    id: string;
    caption: string;
    creator_name: string;
    vote_count: number;
    remix_count: number;
  }[];
  tagDistribution: { tag: string; count: number }[];
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/stats");
      const data = await res.json();
      setStats(data);
      setLastRefresh(new Date());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const lolRatio = stats
    ? stats.totalVotes > 0
      ? Math.round((stats.totalLols / (stats.totalLols + stats.totalNahs)) * 100)
      : 0
    : 0;

  return (
    <div className="fade-in">
      <Header
        title="Overview"
        subtitle={`Last refreshed ${lastRefresh.toLocaleTimeString()}`}
        action={
          <Button variant="secondary" size="sm" onClick={load} disabled={loading}>
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Refresh
          </Button>
        }
      />

      <div className="p-8 space-y-8">
        {/* Primary stats */}
        <section>
          <h2 className="text-[11px] font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--text-muted)" }}>
            Platform Health
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Total Users"
              value={loading ? "—" : stats?.totalUsers ?? 0}
              icon={Users}
              accent
            />
            <StatCard
              label="Generations"
              value={loading ? "—" : stats?.totalGenerations ?? 0}
              icon={Zap}
              sub="AI captions created"
            />
            <StatCard
              label="Total Votes"
              value={loading ? "—" : stats?.totalVotes ?? 0}
              icon={ThumbsUp}
              sub={`${lolRatio}% positive`}
            />
            <StatCard
              label="Remixes"
              value={loading ? "—" : stats?.totalRemixes ?? 0}
              icon={GitMerge}
              sub="Generations remixed"
            />
          </div>
        </section>

        {/* Vote breakdown + top generations */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Vote breakdown */}
          <div className="card p-5">
            <h3 className="text-[13px] font-semibold mb-4" style={{ color: "var(--text)" }}>
              Vote Breakdown
            </h3>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-[12px] mb-1.5">
                  <span style={{ color: "var(--text-muted)" }}>😂 LOLs</span>
                  <span className="font-medium" style={{ color: "var(--success)" }}>
                    {loading ? "—" : stats?.totalLols ?? 0}
                  </span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-card-hover)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${lolRatio}%`,
                      background: "var(--success)",
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[12px] mb-1.5">
                  <span style={{ color: "var(--text-muted)" }}>😒 Nahs</span>
                  <span className="font-medium" style={{ color: "var(--danger)" }}>
                    {loading ? "—" : stats?.totalNahs ?? 0}
                  </span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-card-hover)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${100 - lolRatio}%`,
                      background: "var(--danger)",
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mt-5 pt-5" style={{ borderTop: "1px solid var(--border)" }}>
              <div className="text-center">
                <div className="stat-number text-xl" style={{ color: "var(--text)" }}>
                  {loading ? "—" : stats?.totalImages ?? 0}
                </div>
                <div className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>Image Inputs</div>
              </div>
              <div className="text-center">
                <div className="stat-number text-xl" style={{ color: "var(--accent)" }}>
                  {lolRatio}%
                </div>
                <div className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>Approval Rate</div>
              </div>
              <div className="text-center">
                <div className="stat-number text-xl" style={{ color: "var(--text)" }}>
                  {loading || !stats ? "—" :
                    stats.totalGenerations > 0
                      ? (stats.totalVotes / stats.totalGenerations).toFixed(1)
                      : "0"}
                </div>
                <div className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>Votes/Gen</div>
              </div>
            </div>
          </div>

          {/* Top generations */}
          <div className="card p-5">
            <h3 className="text-[13px] font-semibold mb-4" style={{ color: "var(--text)" }}>
              🔥 Most Voted Generations
            </h3>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 rounded-lg animate-pulse" style={{ background: "var(--bg-card-hover)" }} />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {stats?.topGenerations.slice(0, 5).map((g, i) => (
                  <div
                    key={g.id}
                    className="flex items-center gap-3 p-2.5 rounded-lg"
                    style={{ background: "var(--bg-card-hover)" }}
                  >
                    <span
                      className="stat-number text-[13px] w-5 text-center flex-shrink-0"
                      style={{ color: i === 0 ? "var(--accent)" : "var(--text-muted)" }}
                    >
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-medium truncate" style={{ color: "var(--text)" }}>
                        {g.caption}
                      </div>
                      <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                        by {g.creator_name}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant="success">+{g.vote_count}</Badge>
                      {g.remix_count > 0 && (
                        <Badge variant="accent">{g.remix_count} 🔀</Badge>
                      )}
                    </div>
                  </div>
                ))}
                {(!stats?.topGenerations || stats.topGenerations.length === 0) && (
                  <p className="text-[13px] text-center py-6" style={{ color: "var(--text-muted)" }}>
                    No generations yet
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Recent activity */}
        <div className="card">
          <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
            <h3 className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>
              Recent Activity
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Caption</th>
                  <th>Creator</th>
                  <th>Votes</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="text-center py-8" style={{ color: "var(--text-muted)" }}>
                      Loading…
                    </td>
                  </tr>
                ) : stats?.recentGenerations.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-8" style={{ color: "var(--text-muted)" }}>
                      No generations yet
                    </td>
                  </tr>
                ) : (
                  stats?.recentGenerations.map((g) => (
                    <tr key={g.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          {g.image_url && (
                            <img
                              src={resolveImageUrl(g.image_url)}
                              alt=""
                              className="w-8 h-8 rounded object-cover flex-shrink-0"
                              style={{ border: "1px solid var(--border)" }}
                            />
                          )}
                          <span
                            className="max-w-xs truncate block text-[13px]"
                            style={{ color: "var(--text)" }}
                          >
                            {g.caption}
                          </span>
                        </div>
                      </td>
                      <td style={{ color: "var(--text-muted)" }}>{g.creator_name}</td>
                      <td>
                        <Badge variant={g.vote_count > 0 ? "success" : g.vote_count < 0 ? "danger" : "muted"}>
                          {g.vote_count > 0 ? "+" : ""}{g.vote_count}
                        </Badge>
                      </td>
                      <td style={{ color: "var(--text-muted)" }}>
                        {new Date(g.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tag cloud */}
        {stats?.tagDistribution && stats.tagDistribution.length > 0 && (
          <div className="card p-5">
            <h3 className="text-[13px] font-semibold mb-4" style={{ color: "var(--text)" }}>
              Popular Tags
            </h3>
            <div className="flex flex-wrap gap-2">
              {stats.tagDistribution.slice(0, 20).map(({ tag, count }) => (
                <span
                  key={tag}
                  className="px-3 py-1 rounded-full text-[12px] font-medium"
                  style={{
                    background: "var(--bg-card-hover)",
                    color: "var(--text)",
                    border: "1px solid var(--border)",
                    fontSize: `${Math.min(14, 11 + count * 0.5)}px`,
                  }}
                >
                  #{tag}
                  <span className="ml-1.5 text-[10px]" style={{ color: "var(--text-muted)" }}>
                    {count}
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
