# AGENTS.md — 台灣租屋防雷網（暫定，rental-aggregator）

> **目前狀態：建議暫緩，需 Sean 決定方向後才開發**（見 `PRD/SPEC.md` §0、§14）。決定前只允許文件修改。

## 1. 權威規格與範圍

- 唯一規格來源：[`PRD/SPEC.md`](./PRD/SPEC.md) v4.0；M1 範圍與驗收：[`GOAL.md`](./GOAL.md)；進度：[`STATUS.md`](./STATUS.md)；操作：[`SOP.md`](./SOP.md)。
- 產品已從「黑心房東黑名單」轉向「屋況檢查清單＋租約草稿產生器」。`BUILD_REPORT.md`、`PLAN.md`、`SECURITY_FINDINGS.md`、`rpb-*.log`、`dashboard.html` 為舊版歷史紀錄，不是規格。
- 所有實作必須對應 SPEC §6 的 FR 編號與 GOAL.md 的 AC 編號。

## 2. 絕對不做

- **不新增、不恢復任何對特定房東、房客或物件的公開評價、指控、黑名單或檢舉功能**；若有需求，先由 Sean 取得律師意見。
- **不爬取、不串接第三方平台資料**（591、樂屋網、Dcard、PTT、FB 社團等），也不做自動刊登。看房比較只用使用者自己輸入的資料。
- 不保存第三人完整姓名、不以 IP 作為使用者識別碼、不把使用者輸入內容寫進伺服器 log。
- 不提供個案法律意見；租約規則只做提示，每條規則要有出處與「需人工覆核」標示。
- 不寫入真實個資、真實租約、真實照片、憑證。範例一律用假資料：姓名加「示範」或「測試」、電話 0900-000-xxx、Email `@example.com`、地址「示範市示範區」。
- 不接真實金流、真實通知、付費 API 正式呼叫。

## 3. 開發流程

1. 修改前讀本檔、`SOP.md`、`STATUS.md` 與 SPEC 對應章節。
2. 每個增量都要補測試；新增 `src/lib/*.ts` 必須有同層 `*.test.ts`，新增頁面或元件必須有 Testing Library 測試。
3. 交付前跑完 §4 全部指令並保留輸出與 exit code；任何一項失敗不得合併。
4. agent 不得 push 到 `main`、合併 PR、部署、修改 Vercel 或 GitHub 設定、旋轉 secrets。
5. 資料庫 migration、帳號、金流、上傳、任何伺服器端寫入，需 Sean 人審後才可開始。

## 4. 驗證命令

工作目錄為 repo 根目錄。指令皆來自 `package.json`。

| 類型 | 指令 | 現況 |
|---|---|---|
| Lint | `npm run lint` | 已定義；CI 通過 |
| Typecheck | `npm run typecheck` | 已定義；CI 因前置失敗未執行到 |
| Unit | `npm test` | 已定義；CI 失敗（rollup 原生模組缺漏，GOAL AC-001 修） |
| Coverage | `npm run test:coverage` | 已定義；門檻 70%（`vitest.config.ts`） |
| Build | `npm run build` | 已定義（`prisma generate && next build --webpack`） |
| Prisma | `npm run db:generate`、`npx prisma validate` | 已定義／可用 |
| Format | 尚未配置 | — |
| E2E | 尚未配置 | M2 前再評估 |

## 5. 技術約束（沿用舊版經驗，仍有效）

- Next.js 不得低於 16.3.0；build 用 `next build --webpack`，不要改回 Turbopack。
- 不要在 `postinstall` 跑 `prisma generate`；不要開 `output: "standalone"`。
- 不要在 Vercel 用 SQLite。M1 不需要資料庫寫入。
- 接受外部 URL 的欄位一律限制 http(s)；公開 POST 端點必須先過 `checkRateLimit()`。

## 6. Commit 規則

`<type>(scope): <FR／AC 編號或說明>`，例如 `feat(inspection): AC-003 入住退租對照`。結尾依 repo 慣例加 Co-Authored-By。
