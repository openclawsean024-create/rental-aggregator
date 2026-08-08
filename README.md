# 台灣租屋防雷網 (Rental Aggregator)

> 591 不會告訴你的事：黑心房東黑名單 + 屋況檢查清單 + 定型化租約產生器 + 押金信託比較

![status](https://img.shields.io/badge/M1-MVP-blue)
![next](https://img.shields.io/badge/Next.js-15.1.0-black)
![node](https://img.shields.io/badge/node-22.23.2-green)
![coverage](https://img.shields.io/badge/coverage-95.09%25-brightgreen)

## 狀態

- **M1 黑名單 MVP** — ✅ 2026-08-08 完成
- **M2 屋況 + 租約** — ⏳ 待開工
- **M3 信託 + 付費** — ⏳ 待開工
- **M4 Beta** — ⏳
- **M5 Public Launch** — ⏳

完整 PRD 見 [`PRD/SPEC.md`](./PRD/SPEC.md)。

## 技術棧

- **Frontend** — Next.js 15.1.0 + React 19 + TypeScript
- **Styling** — Tailwind CSS 3.4
- **Backend** — Next.js Route Handlers
- **Database** — Prisma 5.22 (SQLite dev → Postgres prod)
- **Testing** — Vitest 2.1 + @testing-library/react + happy-dom
- **Icons** — lucide-react
- **Deployment** — Vercel (manual `vercel deploy --prod`)

## 開發

```bash
# 安裝依賴
npm install --legacy-peer-deps

# 跑 Prisma migrate + 預載 1,000 筆黑名單
npm run db:migrate
npm run db:seed

# 啟動 dev server
npm run dev

# 跑測試
npm test

# 跑測試 + coverage
npm run test:coverage
```

### 啟動後訪問

- 首頁 — http://localhost:3000
- 黑名單查詢 API — `http://localhost:3000/api/blacklist?q=王&district=大安`
- 統計 API — `http://localhost:3000/api/blacklist/stats`
- 健康檢查 — `http://localhost:3000/api/health`

## API 契約

### `GET /api/blacklist?q=&district=&category=&limit=&offset=`

查詢已審核的黑名單（去識別化版本）。

**驗收** — PRD §5.1：< 500ms

```bash
curl "http://localhost:3000/api/blacklist?q=王&district=大安"
```

回應：

```json
{
  "items": [
    {
      "id": "...",
      "landlordName": "王○明",
      "addressDistrict": "台北市大安區",
      "addressDetail": null,
      "category": "deposit_dispute",
      "description": "...",
      "reportCount": 1,
      "viewCount": 234,
      "severity": 4,
      "lastIncidentAt": "2026-07-07T08:42:27.579Z",
      "createdAt": "2026-08-08T13:48:58.312Z"
    }
  ],
  "total": 56,
  "limit": 20,
  "offset": 0,
  "query": { "q": "王", "district": "大安" },
  "elapsedMs": 12
}
```

### `POST /api/blacklist`

提交檢舉（進入審核佇列，status=pending）。

```bash
curl -X POST -H "Content-Type: application/json" -d '{
  "landlordName": "張大膽",
  "addressDistrict": "台北市大安區",
  "category": "deposit_dispute",
  "description": "退租時房東拒退 2 個月押金，目前仍在訴訟中"
}' http://localhost:3000/api/blacklist
```

回應：

```json
{
  "ok": true,
  "entry": {
    "id": "...",
    "landlordName": "張○膽",
    "addressDistrict": "台北市大安區",
    "status": "pending",
    "createdAt": "2026-08-08T13:59:13.952Z"
  },
  "message": "檢舉已提交，進入管理員審核佇列（3-7 個工作天）"
}
```

## 個資保護（PRD §5.2 / ADR-002）

- 房東姓名一律在 DB 端存為「王○明」格式
- 一般查詢 API 只回 `landlordName`（去識別化）
- 完整姓名 `landlordNameFull` 僅 Pro 用戶才能看（M3 實作）

## 測試

```
✓ src/lib/mask.test.ts (10 tests)
✓ src/lib/categories.test.ts (5 tests)
✓ src/components/TopDistricts.test.tsx (3 tests)
✓ src/components/BlacklistSearch.test.tsx (4 tests)

Test Files  4 passed (4)
     Tests  22 passed (22)
  Coverage  95.09% statements / 92.47% branches / 83.33% functions
```

## 部署

Vercel 手動部署（沒有 GitHub webhook）：

```bash
npx vercel deploy --prod --yes --token $VERCEL_TOKEN
```

## 環境變數

複製 `.env.example` 為 `.env` 然後填入。**絕對不要 commit `.env`**。

## 設計準則

- **色系** — slate-50 背景 + indigo/brand 主色 + amber-500 警示 + red-700 嚴重
- **字體** — Inter / Noto Sans TC，內文 14/15px 行高 1.6
- **互動** — 100ms transition + focus ring-2
- **資訊密度** — 首屏 hero 搜尋列 + 熱門風險區 TOP 5 + 最近 7 天新增
- **信任感** — 每頁 footer 都有免責聲明 + 資料來源 + 律師顧問 placeholder
- **可及性** — WCAG AA color contrast
