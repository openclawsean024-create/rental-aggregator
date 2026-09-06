# 變更日誌 (CHANGELOG)

> 維護者：Sean Li（rental-aggregator owner）
> 對齊 10-repo-fleet fleet-wide 規格契約

---

## v3.0.2 — 2026-09-06 — `Sean 10-repo-fleet` batch 3E

> 程式面 / CI 面 / 工具面 hardening，**不變更 v3.0 產品 spec**。

### Changed
- **`package.json` `lint` script**：`next lint` → `eslint .`（Next.js 16 已移除內建 `next lint`）
- **`eslint.config.mjs`**：新增 ESLint flat config（直接用 `@typescript-eslint/parser` + `@typescript-eslint/eslint-plugin`，繞過 `eslint-config-next` 在 Next 16 + FlatCompat 的 `zod/v4/core` subpath export 衝突）
- **`.github/workflows/ci.yml`**：升級為 4-job CI（lint / test / build / deploy to Vercel），對齊 fleet 模板
- **`PRD/SPEC.md`**：在文件頂端新增 v3.0.2 patch 說明（產品 §1–§16 內容完全不動）
- **`PRD/CHANGELOG.md`**：本檔案（v3.0.2 變更日誌）

### Removed
- `src/app/api/blacklist/route.ts` — 移除 `getStats`、`type BlacklistItem` 兩個 unused import
- `src/data/blacklist-store.test.ts` — 移除 unused local `const all`
- `src/lib/rate-limit.test.ts` — 移除 unused `isRedisConfigured` import

### Fixed
- `npm run lint` 在 Next.js 16 環境下完全壞掉（`Invalid project directory` 然後 `next: command not found` 風格錯誤）— 改用獨立 ESLint flat config 修復

### Verification（v3.0.2 完成時的狀態）
- `npm test` — **111 / 111 passed**（8 test files，0.99s）
- `npm run typecheck` — **0 error**（tsc --noEmit）
- `npm run lint` — **0 error, 3 warning**（warning 全為測試 mock 內的 `as any`，刻意保留）
- `npm run build` — **OK**（3 static + 3 dynamic route，含 `/api/blacklist` `/api/blacklist/stats` `/api/health`）
- `npm audit --omit=dev` — **0 vulnerabilities**（既有 M3 hardening round 已達標）
- Coverage：97.16% statements / 92.81% branches / 92% functions（既有 baseline）

### Files changed in v3.0.2
| 檔案 | 變更摘要 |
|---|---|
| `package.json` | `lint` script 改用 `eslint .` |
| `eslint.config.mjs` | 新增（ESLint flat config，~80 行） |
| `.github/workflows/ci.yml` | 4-job CI 升級 |
| `PRD/SPEC.md` | 頂端加 v3.0.2 patch header |
| `PRD/CHANGELOG.md` | 本檔案 |
| `src/app/api/blacklist/route.ts` | 移除 2 個 unused import |
| `src/data/blacklist-store.test.ts` | 移除 1 個 unused var |
| `src/lib/rate-limit.test.ts` | 移除 1 個 unused import |

### 部署契約（不變）
- **Production target**：Vercel（`vercel.json` + `npx vercel deploy --prod`）
- **Preview**：每個 PR（Vercel 自動 preview deployment）
- **CI 觸發**：push to `main` + 任何 `pull_request`
- **CI 內容**：lint → test → build → deploy（4 jobs，10 min timeout，cancel-in-progress）

### 已知 NFR 限制
- POST `/api/blacklist` rate limit 在 Vercel serverless 多實例下採 Upstash Redis 共享狀態（`@upstash/ratelimit`），見 `README.md` M3.5 section
- Free Upstash tier 10K commands/day 足夠本場景（5 req/min × 60 × 24 = 7200/day 單 IP worst case）

---

## v3.0.1 — 2026-08-29 — M3.5 Rate limit hardening

> （既有記錄，由 repo owner 維護）

- Upstash Redis 共享狀態（取代 in-memory）
- 4 個新 mock-based test case
- Coverage `rate-limit.ts` 100% statements
- 既有 107 tests 全綠

---

## v3.0 — 2026-07-19 — Sweet-spot rewrite v2

> （既有記錄，由 repo owner 維護）

- 591 vs 我們甜蜜點的可量化證據
- 黑名單資料累積 SOP（3 階段）
- 銀行合作 contact list
- 量化 KPI 強化

---

## v2.2.1 — 2026-07-10 — 跨平台比價原型

- 初版 spec，後被 sweet-spot 體檢判定紅海 → v3.0 重寫

---

> v3.0.2 完成於 **2026-09-06 by Sean 10-repo-fleet**（batch 3E, repo rank #29）
