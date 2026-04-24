"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Bar,
} from "recharts";
import { Card, CardSkeleton } from "@/shared/components";

const PERIOD_FILTERS = ["all", "daily", "monthly", "total"];

function fmtTokens(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function getUtilizationPercent(used, limit, enabled) {
  if (!enabled || !Number.isFinite(limit) || limit <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((used / limit) * 100)));
}

export default function QuotaDashboardClient() {
  const [loading, setLoading] = useState(true);
  const [keys, setKeys] = useState([]);
  const [periodFilter, setPeriodFilter] = useState("all");

  useEffect(() => {
    let mounted = true;
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/keys/quota", { cache: "no-store" });
        const data = await res.json();
        if (mounted && res.ok) {
          setKeys(data.keys || []);
        }
      } catch {
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchData();
    const id = setInterval(fetchData, 10000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  const filteredKeys = useMemo(() => {
    return (keys || []).filter((k) => {
      if (!k?.quota?.enabled) return false;
      if (periodFilter === "all") return true;
      return k.quota?.period === periodFilter;
    });
  }, [keys, periodFilter]);

  const chartData = useMemo(() => {
    return filteredKeys
      .map((k) => {
        const used = Number(k.quota?.usedTokens || 0);
        const limit = Number(k.quota?.limit || 0);
        const remaining = Math.max(limit - used, 0);
        return {
          name: k.name,
          used,
          remaining,
          limit,
          utilization: getUtilizationPercent(used, limit, true),
          period: k.quota?.period,
        };
      })
      .sort((a, b) => b.utilization - a.utilization)
      .slice(0, 20);
  }, [filteredKeys]);

  const summary = useMemo(() => {
    const totals = {
      keys: filteredKeys.length,
      used: 0,
      limit: 0,
      highRisk: 0,
    };

    for (const k of filteredKeys) {
      const used = Number(k.quota?.usedTokens || 0);
      const limit = Number(k.quota?.limit || 0);
      const utilization = getUtilizationPercent(used, limit, true);
      totals.used += used;
      totals.limit += limit;
      if (utilization >= 90) totals.highRisk += 1;
    }

    return totals;
  }, [filteredKeys]);

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-semibold">API Key Quota Usage</h2>
            <p className="text-sm text-text-muted">Top 20 keys by utilization</p>
          </div>
          <div className="flex items-center gap-1 bg-bg-subtle rounded-lg p-1 border border-border">
            {PERIOD_FILTERS.map((value) => (
              <button
                key={value}
                onClick={() => setPeriodFilter(value)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${periodFilter === value ? "bg-primary text-white shadow-sm" : "text-text-muted hover:text-text hover:bg-bg-hover"}`}
              >
                {value.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {chartData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-sm text-text-muted">
            No quota-enabled API keys found.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
              <YAxis tickFormatter={fmtTokens} width={56} />
              <Tooltip
                formatter={(value, name) => [fmtTokens(value), name === "used" ? "Used" : "Remaining"]}
                labelFormatter={(label) => `Key: ${label}`}
              />
              <Legend />
              <Bar dataKey="used" name="Used" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="remaining" name="Remaining" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-text-muted">Quota Keys</p>
            <p className="text-xl font-semibold">{summary.keys}</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-text-muted">Total Used</p>
            <p className="text-xl font-semibold">{fmtTokens(summary.used)}</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-text-muted">Total Limit</p>
            <p className="text-xl font-semibold">{fmtTokens(summary.limit)}</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-text-muted">Critical (≥90%)</p>
            <p className="text-xl font-semibold text-orange-500">{summary.highRisk}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

