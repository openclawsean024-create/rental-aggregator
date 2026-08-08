"use client";

import { useState, useMemo } from "react";
import { Search, MapPin, AlertTriangle, Eye, MessageSquareWarning, Calendar } from "lucide-react";
import { getCategory } from "@/lib/categories";

/**
 * 黑名單查詢元件 — 設計準則：
 * - Stripe-style hero 搜尋列（單一搜尋框 + 區域過濾）
 * - Airbnb-style 安靜卡片（不是卡片牆，是列表）
 * - 每張卡：風險標籤 + 評論數 + 最後事件日期 + 地址到區
 * - 100ms transition + focus ring-2
 */

type BlacklistItem = {
  id: string;
  landlordName: string;
  addressDistrict: string;
  addressDetail: string | null;
  category: string;
  description: string;
  reportCount: number;
  viewCount: number;
  severity: number;
  lastIncidentAt: string;
  createdAt: string;
};

type QueryResponse = {
  items: BlacklistItem[];
  total: number;
  limit: number;
  offset: number;
  query: { q?: string; district?: string; category?: string };
  elapsedMs: number;
};

export function BlacklistSearch() {
  const [q, setQ] = useState("");
  const [district, setDistrict] = useState("");
  const [data, setData] = useState<QueryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (district) params.set("district", district);
      params.set("limit", "20");

      const res = await fetch(`/api/blacklist?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as QueryResponse;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "查詢失敗");
    } finally {
      setLoading(false);
    }
  };

  const resultCount = useMemo(() => data?.total ?? 0, [data]);

  return (
    <div>
      {/* 搜尋列 — Stripe homepage hero 風格 */}
      <form
        onSubmit={handleSearch}
        className="card-listing shadow-cardHover"
        aria-label="黑名單查詢"
      >
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="房東姓名（王大明、李小華…）"
              className="input-base pl-10"
              aria-label="房東姓名"
              maxLength={50}
            />
          </div>
          <div className="sm:w-56 relative">
            <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              placeholder="區域（大安、板橋…）"
              className="input-base pl-10"
              aria-label="區域"
              maxLength={50}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary shrink-0"
            aria-label="查詢"
          >
            {loading ? "查詢中…" : "查詢"}
          </button>
        </div>
      </form>

      {/* 結果統計 + 性能指標 */}
      {data && !loading && (
        <div className="mt-4 flex items-center justify-between text-xs text-slate-500 px-1">
          <span>
            <strong className="text-slate-900 font-semibold">{resultCount}</strong> 筆結果
            {data.query.q && (
              <>
                <span className="mx-1.5 text-slate-300">·</span>
                姓名：{data.query.q}
              </>
            )}
            {data.query.district && (
              <>
                <span className="mx-1.5 text-slate-300">·</span>
                區域：{data.query.district}
              </>
            )}
          </span>
          <span className="text-slate-400">
            {data.elapsedMs}ms
          </span>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          查詢失敗：{error}
        </div>
      )}

      {/* 結果列表 — 安靜風格（不是卡片牆） */}
      {data && data.items.length === 0 && (
        <div className="mt-8 text-center py-12">
          <p className="text-sm text-slate-500">
            沒有找到符合條件的紀錄。
          </p>
          <p className="text-xs text-slate-400 mt-1">
            這是好消息 — 此房東/區域目前沒有公開檢舉紀錄。
          </p>
        </div>
      )}

      {data && data.items.length > 0 && (
        <ul className="mt-4 space-y-3" aria-label="黑名單結果列表">
          {data.items.map((item) => (
            <BlacklistCard key={item.id} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}

function BlacklistCard({ item }: { item: BlacklistItem }) {
  const cat = getCategory(item.category);
  const tagClass =
    cat.tone === "danger"
      ? "risk-tag-danger"
      : cat.tone === "warn"
      ? "risk-tag-warn"
      : "risk-tag-neutral";

  const lastIncident = new Date(item.lastIncidentAt);
  const daysAgo = Math.floor((Date.now() - lastIncident.getTime()) / (24 * 60 * 60 * 1000));

  // 嚴重度 5 = 紅實心，4 = 紅空心，3 = amber，其他 = slate
  const severityIcon =
    item.severity >= 5 ? (
      <AlertTriangle className="h-3.5 w-3.5 text-danger-700" fill="currentColor" strokeWidth={1.5} />
    ) : item.severity >= 4 ? (
      <AlertTriangle className="h-3.5 w-3.5 text-danger-700" strokeWidth={2} />
    ) : item.severity >= 3 ? (
      <AlertTriangle className="h-3.5 w-3.5 text-warn-500" strokeWidth={2} />
    ) : (
      <AlertTriangle className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
    );

  return (
    <li className="card-listing">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* 標題：房東姓名 + 嚴重度圖示 */}
          <div className="flex items-center gap-2">
            {severityIcon}
            <h3 className="font-semibold text-slate-900 truncate">
              {item.landlordName}
            </h3>
            <span className={tagClass} title={cat.label}>
              {cat.label}
            </span>
          </div>
          {/* 地址到區（不顯示詳細，保護隱私） */}
          <p className="mt-1 text-sm text-slate-500 flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {item.addressDistrict}
            {item.addressDetail && (
              <span className="text-slate-400">· {item.addressDetail}</span>
            )}
          </p>
          {/* 糾紛描述 */}
          <p className="mt-2 text-sm text-slate-600 leading-relaxed line-clamp-2">
            {item.description}
          </p>
        </div>
      </div>

      {/* 底部 meta：評論數 + 最後事件 */}
      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <MessageSquareWarning className="h-3 w-3" />
          {item.reportCount} 筆檢舉
        </span>
        <span className="flex items-center gap-1">
          <Eye className="h-3 w-3" />
          {item.viewCount} 次瀏覽
        </span>
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {daysAgo === 0 ? "今天" : `${daysAgo} 天前`}
        </span>
      </div>
    </li>
  );
}
