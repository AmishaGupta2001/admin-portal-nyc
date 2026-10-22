"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
  LineChart, Line, AreaChart, Area,
} from "recharts";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";

interface AnalyticsData {
  generationsOverTime: { date: string; count: number }[];
  votesOverTime: { date: string; lols: number; nahs: number }[];
  topCreators: { name: string; count: number; votes: number }[];
  imageUsage: { title: string; count: number }[];
  remixDepth: { depth: string; count: number }[];
}

const LIME = "#B4FF47";
const RED = "#FF5555";
const BLUE = "#60A5FA";
const MUTED = "#6B7280";

function ChartTooltipStyle() {
  return (
    <style>{`
      .recharts-tooltip-wrapper .recharts-default-tooltip {
        background: var(--bg-card) !important;
        border: 1px solid var(--border) !important;
        border-radius: 8px !important;
        font-size: 12px !important;
        color: var(--text) !important;
      }
    `}</style>
  );
}

export default function StatsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/analytics");
      const json = await res.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const chartBg = "transparent";
  const gridColor = "var(--border)";
  const textColor = "var(--text-muted)";

  return (
    <div className="fade-in">
      <ChartTooltipStyle />
      <Header
        title="Analytics"
        subtitle="Trends and patterns across the platform"
        action={
          <Button variant="secondary" size="sm" onClick={load} disabled={loading}>
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Refresh
          </Button>
        }
      />

      <div className="p-8 space-y-6">
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="card p-5 h-64 animate-pulse" style={{ background: "var(--bg-card)" }} />
            ))}
          </div>
        ) : (
          <>
            {/* Generations over time */}
            <div className="card p-5">
              <h3 className="text-[13px] font-semibold mb-5" style={{ color: "var(--text)" }}>
                Generations Over Time (last 30 days)
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={data?.generationsOverTime ?? []}>
                  <defs>
                    <linearGradient id="limeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={LIME} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={LIME} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis dataKey="date" tick={{ fill: textColor, fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: textColor, fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "var(--text)" }}
                  />
                  <Area type="monotone" dataKey="count" stroke={LIME} fill="url(#limeGrad)" strokeWidth={2} name="Generations" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Vote sentiment over time */}
              <div className="card p-5">
                <h3 className="text-[13px] font-semibold mb-5" style={{ color: "var(--text)" }}>
                  Vote Sentiment Over Time
                </h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data?.votesOverTime ?? []} barSize={8}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: textColor, fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: textColor, fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                    />
                    <Bar dataKey="lols" fill={LIME} name="😂 LOLs" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="nahs" fill={RED} name="😒 Nahs" radius={[4, 4, 0, 0]} />
                    <Legend wrapperStyle={{ fontSize: 11, color: textColor }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Most used images */}
              <div className="card p-5">
                <h3 className="text-[13px] font-semibold mb-5" style={{ color: "var(--text)" }}>
                  Most Used Image Inputs
                </h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data?.imageUsage ?? []} layout="vertical" barSize={14}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                    <XAxis type="number" tick={{ fill: textColor, fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis
                      dataKey="title"
                      type="category"
                      width={110}
                      tick={{ fill: textColor, fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                    />
                    <Bar dataKey="count" fill={BLUE} name="Generations" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top creators */}
            <div className="card p-5">
              <h3 className="text-[13px] font-semibold mb-5" style={{ color: "var(--text)" }}>
                Top Creators by Activity
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data?.topCreators?.slice(0, 10) ?? []} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: textColor, fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: textColor, fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                  />
                  <Bar dataKey="count" fill={LIME} name="Generations" radius={[4, 4, 0, 0]} barSize={20} />
                  <Bar dataKey="votes" fill={BLUE} name="Votes Received" radius={[4, 4, 0, 0]} barSize={20} />
                  <Legend wrapperStyle={{ fontSize: 11, color: textColor }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
