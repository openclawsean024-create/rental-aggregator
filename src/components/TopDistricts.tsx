"use client";

import { useEffect, useState } from "react";

type Stats = {
  topDistricts: { district: string; count: number }[];
  recentCount: number;
  totalApproved: number;
  pendingCount: number;
};

/**
 * 熱門風險區 TOP 5 + 統計數字
 * 設計準則：資訊密度高（首屏可見）
 */
export function TopDistricts() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/blacklist/stats")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setStats(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || !stats) {
    return (
      <div className="card-listing">
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-9 bg-slate-100 rounded animate-pulse"
              aria-label="載入中"
            />
          ))}
        </div>
      </div>
    );
  }

  const max = Math.max(...stats.topDistricts.map((d) => d.count), 1);

  return (
    <div className="card-listing">
      {/* 三個數字 chip */}
      <div className="flex gap-4 mb-4 pb-4 border-b border-slate-100">
        <div>
          <p className="text-2xl font-semibold text-slate-900 tabular-nums">
            {stats.totalApproved.toLocaleString()}
          </p>
          <p className="text-xs text-slate-500">已審核總數</p>
        </div>
        <div className="border-l border-slate-100 pl-4">
          <p className="text-2xl font-semibold text-brand-600 tabular-nums">
            +{stats.recentCount}
          </p>
          <p className="text-xs text-slate-500">最近 7 天新增</p>
        </div>
        <div className="border-l border-slate-100 pl-4">
          <p className="text-2xl font-semibold text-slate-400 tabular-nums">
            {stats.pendingCount}
          </p>
          <p className="text-xs text-slate-500">待審核中</p>
        </div>
      </div>

      {/* TOP 5 bar chart */}
      <ul className="space-y-2.5" aria-label="熱門風險區 TOP 5">
        {stats.topDistricts.map((d, i) => {
          const pct = (d.count / max) * 100;
          return (
            <li key={d.district} className="flex items-center gap-3">
              <span className="text-xs text-slate-400 w-4 tabular-nums font-medium">
                {i + 1}
              </span>
              <span className="text-sm text-slate-700 w-28 shrink-0 truncate">
                {d.district}
              </span>
              <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-brand-500 rounded-full transition-all duration-200"
                  style={{ width: `${pct}%` }}
                  aria-label={`${d.district} ${d.count} 筆`}
                />
              </div>
              <span className="text-xs text-slate-600 w-8 text-right tabular-nums">
                {d.count}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
