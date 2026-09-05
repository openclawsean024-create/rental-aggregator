# 台灣租屋防雷網 (Rental Aggregator)

> 591 不會告訴你的事：黑心房東黑名單 + 屋況檢查清單 + 定型化租約產生器 + 押金信託比較

![CI](https://github.com/openclawsean024-create/rental-aggregator/actions/workflows/ci.yml/badge.svg)
![status](https://img.shields.io/badge/M1-MVP-blue)
![next](https://img.shields.io/badge/Next.js-15.1.0-black)
![node](https://img.shields.io/badge/node-22.23.2-green)
![coverage](https://img.shields.io/badge/coverage-97.16%25-brightgreen)

## 狀態

- **M1 黑名單 MVP** — ✅ 2026-08-08 完成（含 2026-08-29 hardening round：CI + tests + security headers）
- **M2 屋況 + 租約** — ⏳ 待開工
- **M3 信託 + 付費** — ⏳ 待開工
- **M4 Beta** — ⏳
- **M5 Public Launch** — ⏳

完整 PRD 見 [`PRD/SPEC.md`](./PRD/SPEC.md)；本輪 hardening 細節見 [`BUILD_REPORT.md`](./BUILD_REPORT.md) 與 [`SECURITY_FINDINGS.md`](./SECURITY_FINDINGS.md)。

## 技術棧

- **Frontend** — Next.js 15.1 + React 19 + TypeScript + Tailwind 3.4
- **Backend** — Next.js Route Handlers + Prisma 5.22 (SQLite dev → Postgres prod)
- **Testing** — Vitest 2.1 + @testing-library/react + happy-dom
- **Deployment** — Vercel (`vercel deploy --prod --yes`)

## 開發流程

- **分支策略** — `main` 為 production branch，PR 必須 green CI 才可合併；本 repo 無 staging / dev branch，所有 hardening round 都在 main 累積 commit，達 verified 狀態後再 push。
- **Commit 前綴** — `rpb(<owner>): <scope>`（`rpb(backend):` / `rpb(qa):` / `rpb(security):` / `rpb(docs):` / `rpb(devops):` / `rpb(orchestrator):`）。完整變更見 [`BUILD_REPORT.md`](./BUILD_REPORT.md)。
- **CI 觸發** — push 到 `main` + 任何 `pull_request` 觸發 [`.github/workflows/ci.yml`](./.github/workflows/ci.yml)，跑 `db:generate` → `typecheck` → `test` → `build`（10 分鐘 timeout，cancel-in-progress）。
- **本機 verify**（改任何 code / test 後必跑）：`npm run typecheck` / `npm test` / `npm run build`，存到 `rpb-<role>-verify.log`。

## 開發

```bash
npm install --legacy-peer-deps
npm run db:migrate && npm run db:seed   # 預載 1,000 筆黑名單
npm run dev                              # http://localhost:3000
npm test
```

### 啟動後訪問

- 首頁 — http://localhost:3000
- 黑名單查詢 API — `http://localhost:3000/api/blacklist?q=王&district=大安`
- 統計 API — `http://localhost:3000/api/blacklist/stats`
- 健康檢查 — `http://localhost:3000/api/health`

## API 契約

### `GET /api/blacklist?q=&district=&category=&limit=&offset=`

查詢已審核的黑名單（去識別化版本）。**驗收** — PRD §5.1：< 500ms。

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
      "reportCount": 1,
      "severity": 4,
      "lastIncidentAt": "2026-07-07T08:42:27.579Z"
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
  "description": "退租時房東拒退 2 個月押金"
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
    "status": "pending"
  },
  "message": "檢舉已提交，進入管理員審核佇列（3-7 個工作天）"
}
```

## 個資保護（PRD §5.2 / ADR-002）

- 房東姓名一律在 DB 端存為「王○明」格式；一般查詢 API 只回 `landlordName`（去識別化）
- 完整姓名 `landlordNameFull` 僅 Pro 用戶才能看（M3 實作）
- ADR-002 invariant 由 `src/lib/mask-invariant.test.ts` 靜態守住（所有 /api/blacklist response path 都必須 mask）

## Security posture (M3 hardening, 2026-08-29)

M3 hardening round 加了下列 production 強化（細節見 [`SECURITY_FINDINGS.md`](./SECURITY_FINDINGS.md)）：

- **Security headers**（`vercel.json`） — `X-Content-Type-Options: nosniff`、`X-Frame-Options: DENY`、`HSTS`、`Referrer-Policy`、`Permissions-Policy`、完整 CSP（`default-src 'self'` + `frame-ancestors 'none'`）
- **POST rate limit** — `POST /api/blacklist` per-IP sliding window 5 req/min（`src/lib/rate-limit.ts`），超限回 429 + `Retry-After`。Vercel 多實例不精確留 follow-up（PLAN.md R2）
- **evidenceUrls scheme allowlist** — `PostSchema.evidenceUrls` 升級為 `.url().refine(/^https?:\/\//i)`，拒絕 `javascript:` / `data:` / `file:` / `ftp:`（commit `23e7683`）
- **OWASP 掃描** — 0 critical、1 high（XSS，已修）、2 medium（皆已修）、1 known limitation。`npm audit --omit=dev` 0 vulnerabilities

### M3.5 Rate limit hardening（commit `9ea4901` + `7705758`）

M3 的 in-memory rate limit 在 Vercel serverless 多實例下不精確（見 `SECURITY_FINDINGS.md` R2）。
M3.5 升級為 **Upstash Redis 共享狀態**：

- **Primary path**：Upstash Redis HTTP REST（`@upstash/ratelimit` `slidingWindow(5, "60 s")`）
- **In-instance fast path**：`ephemeralCache: Map()` — 同 instance 內每秒打多次不重複打 Redis
- **Graceful fallback**：Redis 不可達時（env 未設 / init throw / runtime throw）→ `console.warn` + in-memory Map fallback（不 throw 給 caller，破壞既有功能）
- **API 不變**：`checkRateLimit(ip, limit, windowMs)` 維持同樣 signature（改 async，caller 已 `await`）
- **Setup**：在 https://console.upstash.com/ 建立 Redis database → 設 `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` 到 Vercel project env（`.env.example` 已有 placeholder）
- **Free tier**：10K commands/day 足夠這個 case（5 req/min × 60 × 24 = 7200/day 單 IP worst case）
- **Coverage**：`rate-limit.ts` 100% statements，4 個新 mock-based test case（Redis happy / over limit / down fallback / init failure）

未動：API contract（caller 已 `await`）、既有 107 tests 全綠。

## 測試

M3 baseline（`rpb-backend-verify.log`）：

```
Test Files  8 passed (8)
     Tests  107 passed (107)
  Coverage  97.16% statements / 92.81% branches / 92% functions
```

對比 M1 baseline：22 → 107 tests（+386%）、coverage 95.09% → 97.16% statements。8 個 test 檔案列表見 `BUILD_REPORT.md`。

本機 verify 三個 command：

```bash
npm run typecheck
npm test
npm run build
```

完整輸出見 `rpb-docs-verify.log`（本 round）與 `rpb-*-verify.log`（先前 rounds）。

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
- **信任感** — 每頁 footer 都有免責聲明 + 律師顧問 placeholder
- **可及性** — WCAG AA color contrast

<!-- Last validated: 2026-09-06 by OpenClaw Overnight Dev -->
