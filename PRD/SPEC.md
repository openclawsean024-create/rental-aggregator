# 台灣租屋防雷網（暫定）— 產品需求規格 v4.0

> 版本：v4.0（評估與 PRD 重建）｜更新日期：2026-11-16｜狀態：文件重建，尚未依本版開發
> 主 repo：`openclawsean024-create/rental-aggregator`（預設分支 `main`，重建基準 commit `d2a579c`）
> 候選併入 repo（皆只讀）：`rental-matcher`（`be5f587`）、`home-finder`（`5ea988d`）、`rental-house-aggregator`（`03af4a6`）
> 取代：v3.0 / v3.0.2（2026-07-19 / 2026-09-06）。舊版的 TAM（NT$4.8 億 ARR）、Persona 規模、KR 數字均無出處，本版不再引用為依據；舊版可由 git 歷史查閱。

本文件所有「已實作／部分／未實作」皆以 2026-11-16 實際閱讀原始碼、GitHub Actions 執行紀錄與正式站 API 回應為準。**本機無 node，`npm run lint/typecheck/test/build` 皆未在本機執行**；凡標「CI」者取自 GitHub Actions 紀錄。README 與程式不一致之處列於 §13。

---

## §0 評估結論

| 項目 | 結論 |
|---|---|
| 現況完成度 | **15／100**（依改版方向計）。可沿用的只有 Next.js 16 + Prisma 骨架、Zod 驗證與 rate limit 樣板、Vitest 設定、`Inspection`／`LeaseContract` 空資料表。主打的黑名單（約佔現有程式 90%）建議下架；屋況清單、租約產生器、押金信託、付費牆皆 0 行程式。CI 自 2026-08-29 起連續失敗。 |
| 獲利潛力 | **低**（樂觀情境「中」，待驗證）。理由見下。 |
| 目標客群 | 首次在外租屋的學生與上班族（需求端）；次要為 1–3 戶的小房東（工具端）。 |
| 獲利模式 | **免費增值 + 模板販售**：清單與租約草稿免費，付費解鎖「屋況存證報告 PDF」「租約 PDF + 條款說明」「退租押金爭議整理包」單次購買；B2B 小房東版（SaaS 訂閱）列為 M3 假設。價格全部待確認。 |
| 主要風險 | ① 黑名單：誹謗／名譽侵權與個資風險，且正式站正公開 804 筆**程式生成的假檢舉**；② 平台條款：主 repo 未爬 591，但候選 repo `rental-house-aggregator` 的 PRD 規劃爬 591／樂屋網，不可併入；③ 租約產生器有「提供法律意見」的界線問題；④ 競品是免費的官方範本與公益團體資源。 |
| **建議** | **暫緩**（產品開發），但**立即處理正式站下架**（不需等決定）。 |

**建議理由**：黑名單是唯一做出來的功能，也是法律風險最高的部分，必須下架而非延續。改版後的「屋況檢查清單＋租約產生器」對租屋族有用，但①內政部已免費提供住宅租賃契約範本，②租屋是一年一次左右的低頻事件，③租屋族付費意願未經任何訪談驗證，單獨成產品的營收上限低。建議先由 Sean 決定：(a) 只做 M1 下架與轉向、當作導流工具保留；(b) 併入同帳號的合約類產品（`contract-reviewer`／`contract-tracker`，本次未讀其程式，見 §11）；或 (c) 封存。GOAL.md 已依 (a) 撰寫，但開頭註明需 Sean 決定。

**獲利潛力「低」的理由**
1. 需求端單次性：租屋族通常只在找房、簽約、退租時使用，訂閱留存困難（舊 SPEC 自己也寫「單次事件」）。
2. 免費替代：內政部公告的住宅租賃定型化契約範本可免費下載（具體版本與下載位置待確認）；崔媽媽基金會等公益團體提供租屋諮詢（服務範圍待確認）。
3. 黑名單原本是唯一差異化，但無法合法、可信地經營（見 §8），拿掉之後差異化變弱。
4. 付費單價、轉換率皆無資料；舊 SPEC 的「10% 付費轉換」「NT$99–299/年」為內部假設。

**與其他專案重疊**（依 repo 名稱與描述判斷，除本次 4 個 repo 外均未讀程式）

| repo | 重疊 | 建議 |
|---|---|---|
| `rental-matcher`、`home-finder`、`rental-house-aggregator` | 同屬「找房／租屋聚合」，見 §11 合併清單 | 只搬 `rental-matcher` 的看房比較概念 |
| `contract-reviewer`（M1 SaaS MVP）、`contract-tracker`（合約狀況＋審核法條） | 租約條款審閱 ≈ 本案租約產生器的條款檢查 | 待 Sean 決定是否把租約功能併到合約產品 |
| `realestate-price-tracker`（房地產成交價／租金） | 租金行情可作為「客觀資訊」來源 | M2 再評估，不在 M1 |
| `hotel-pm`（包租代管物業管理） | B2B 小房東／代管 | 本案不做代管 ERP |
| sean0407 帳號 | 未發現租屋相關 repo | — |

**主 repo 是否最佳基礎**：是。4 個 repo 中只有 `rental-aggregator` 有後端、資料模型、API 測試與 CI；`rental-matcher` 是 localStorage 示範頁（371 行），`home-finder` 只有計數器範本，`rental-house-aggregator` 只有 PRD 與靜態 HTML。

---

## 1. 問題

租屋族在「看房 → 簽約 → 入住 → 退租」各階段都有資訊不對稱：

1. **入住時沒有留下屋況證據**：退租時房東主張牆面、設備損壞，房客無法舉證，押金被扣。
2. **看不懂或沒拿到合規租約**：口頭約定、自製合約常缺少應記載事項，或含不得記載的條款。
3. **押金與退租規則不清楚**：不知道押金上限、返還時點、可扣款範圍。

舊版用「黑心房東黑名單」解決第 0 步（看房前查房東），本版放棄此方向，理由見 §8.1。

## 2. 目標客群

| 類型 | 描述 | 備註 |
|---|---|---|
| Primary | 首次在外租屋的學生、社會新鮮人（雅房、套房、整層） | 規模與付費意願待訪談確認 |
| Secondary | 自有 1–3 戶出租的小房東，需要合規租約與入住點交紀錄 | 雙方都可用同一份屋況清單 |
| 不服務 | 包租代管業者、商辦、社會住宅申請 | 與 `hotel-pm` 或政府服務重疊 |

## 3. 獲利模式

| 層級 | 內容 | 價格 |
|---|---|---|
| 免費 | 屋況檢查清單（本機）、租約草稿（本機列印）、押金與退租規則說明 | NT$0 |
| 單次購買（模板販售） | 屋況存證報告 PDF（含照片、時間戳）、租約 PDF + 逐條說明、退租押金爭議整理包 | 待確認 |
| 訂閱（M3 假設） | 小房東版：多物件租約與點交紀錄、到期提醒 | 待確認 |
| 不採用 | 賣房東完整姓名（舊版 Pro 方案）、廣告導流到特定房源 | 法律與信任風險 |

## 4. 競品與差異

競品功能、價格均**未在本次查證，標「待確認」**，不得當作事實引用。

| 競品／替代方案 | 類型 | 本產品差異假設 |
|---|---|---|
| 內政部住宅租賃契約範本 | 官方免費範本 | 以表單填寫、即時檢查押金上限等規則、列印友善；不取代官方範本 |
| 591 租屋網 | 房源平台（是否提供租約或點交工具：待確認） | 不做房源；只做簽約與點交工具 |
| 崔媽媽基金會 | 公益租屋諮詢（範圍待確認） | 工具化、可自助；可考慮導流合作 |
| Dcard／PTT 租屋板、FB 社團 | 經驗分享 | 結構化清單，而非事後抱怨 |
| 一般記事本 + 手機相簿 | 現況替代方案 | 依空間分類、入住／退租對照 |

市場規模：**待確認**（不填數字）。

## 5. 現況盤點（以程式為準）

### 5.1 主 repo `rental-aggregator`

- 技術棧：Next.js 16.3.0（App Router，`next build --webpack`）、React 19、TypeScript、Tailwind 3.4、Prisma 5.22（schema 為 SQLite）、Zod、Upstash Ratelimit、Vitest 2.1 + Testing Library + happy-dom。部署在 Vercel（正式站 `rental-aggregator-three.vercel.app`、`rental-aggregator-sean.vercel.app`，2026-11-16 `/api/health` 回 200）。
- 頁面：只有 `/`（`src/app/page.tsx`）。首頁有黑名單搜尋（`BlacklistSearch`）、熱門風險區 TOP 5（`TopDistricts`）、四大功能介紹文字、「提交檢舉」按鈕連到 `/submit`（**頁面不存在**）。
- API：
  - `GET /api/blacklist`：依姓名片段／區域／類型查詢「已審核」資料，回傳遮罩姓名。
  - `POST /api/blacklist`：rate limit（5 次／分鐘／IP）→ Zod 驗證 → 遮罩後寫入。Prisma 模式同時存**完整姓名** `landlordNameFull`，並以 `anon-<IP>` 當使用者 ID、`anon-<IP>@rental-aggregator.local` 當 email；static 模式只 `console.warn` 整筆內容並回假 ID。
  - `GET /api/blacklist/stats`、`GET /api/health`。
- 資料模式切換：Vercel 上沒有 Postgres URL 時走 static 模式，讀 `src/data/blacklist.json`（**804 筆**，由 `prisma/seed.ts` 以姓氏池＋區域池＋固定描述**程式生成的假資料**；其中 227 筆含「XX 區 NN 鄰」）。正式站目前即為 static 模式。
- 資料模型：`User`、`BlacklistEntry`、`Inspection`（只有 `items` JSON 字串）、`LeaseContract`（房東／房客姓名、租金、押金、起訖日）。後兩者沒有任何程式使用。
- 測試：8 個測試檔，以 grep 計 111 個 `it`／`test` 呼叫（README 寫 107）。`src/app/api/**/route.ts` 被排除在 coverage 之外。未在本機執行。
- CI（`.github/workflows/ci.yml`，4 job：lint → test → build → deploy）：最近 7 次 push 全部失敗，test job 因 `@rollup/rollup-linux-x64-gnu` 找不到而無法啟動（lockfile 疑似在 macOS 產生），build 與 deploy 因此從未執行；lint job 通過（有 `no-explicit-any` 警告）。
- 爬蟲：**主 repo 沒有任何爬取 591、Dcard 或其他平台的程式**；`seed.ts` 與 `AGENTS.md` 明文禁止爬蟲。

### 5.2 候選併入 repo

| repo | 實際內容 | 測試／CI |
|---|---|---|
| `rental-matcher` | Vite + React 19 + Tailwind 4 SPA，5 頁（物件總覽、比較、收藏、看屋行程、訊息），資料是 localStorage 寫死 3 筆物件、3 筆行程、2 則訊息；「新增看屋行程」固定寫入同一筆 mock | 1 個測試檔 11 案例；CI 最近一次失敗 |
| `home-finder` | Vite + React 18 計數器範本（13 行 `App.tsx`），`package.json` 列了 Leaflet 但未使用 | 無測試；CI 失敗 |
| `rental-house-aggregator` | 只有 PRD（802 行）與靜態 `dashboard.html`；PRD 規劃以 Cloudflare Workers 爬 591／樂屋網並「一鍵刊登」到 591／FB 社團 | 無程式；CI 失敗 |

## 6. 功能需求

狀態欄：已實作／部分／未實作；「所在」指目前程式在哪個 repo。

| ID | 需求 | 優先 | 狀態 | 所在 |
|---|---|---|---|---|
| FR-001 | 下架黑名單：移除公開查詢、檢舉 API、假資料檔、首頁黑名單文案與「Dcard 資料來源」聲明 | P0 | 未實作（現況是反向：已上線） | rental-aggregator |
| FR-002 | 屋況檢查清單範本：依空間（玄關、客廳、臥室、廚房、衛浴、陽台、水電、消防與安全）分類，每項可標「正常／瑕疵／不適用」與備註 | P0 | 未實作（僅有空的 `Inspection` 資料表） | rental-aggregator |
| FR-003 | 入住與退租兩次檢查對照，標出新增瑕疵 | P0 | 未實作 | — |
| FR-004 | 屋況清單本機保存、匯出 JSON、列印版面 | P0 | 未實作 | — |
| FR-005 | 租約草稿產生器：表單填寫雙方（假資料）、租金、押金、租期、繳費日、修繕責任等，產出可列印草稿 | P0 | 未實作（僅有空的 `LeaseContract` 資料表） | rental-aggregator |
| FR-006 | 租約規則檢查：押金超過 2 個月租金時警示、必填欄位、租期起訖合理性；每條規則附法規名稱與「需人工覆核」標示 | P0 | 未實作 | — |
| FR-007 | 所有清單與租約頁顯示「非法律意見」免責聲明與官方範本連結 | P0 | 未實作 | — |
| FR-008 | 品質閘門：lint／typecheck／test（含 coverage 門檻）／build 在 CI 真正擋住失敗 | P0 | 部分（有 workflow，但 test job 長期失敗） | rental-aggregator |
| FR-009 | 押金與退租規則說明頁（靜態內容，附官方出處） | P1 | 未實作（首頁僅有文字） | — |
| FR-010 | 看房比較表：使用者**自行輸入**的候選物件（租金、坪數、通勤、屋況分數）並排比較、收藏 | P1 | 部分（`rental-matcher` 有寫死資料的比較與收藏頁） | rental-matcher |
| FR-011 | 看房行程：自行新增時間與地點、標記已看 | P2 | 部分（`rental-matcher` 只能新增固定 mock） | rental-matcher |
| FR-012 | 帳號與雲端保存（測試環境驗證） | P1 | 未實作（`.env.example` 只有 Clerk 佔位） | — |
| FR-013 | 照片上傳與時間戳（物件儲存，測試 bucket） | P1 | 未實作（`.env.example` 只有 R2 佔位） | — |
| FR-014 | 屋況報告／租約 PDF 產出 | P1 | 未實作 | — |
| FR-015 | 付費解鎖（金流測試模式） | P2 | 未實作（`.env.example` 只有 Stripe 佔位） | — |
| FR-016 | 押金信託資訊（只列官方或銀行公開資訊與連結，不做比價推薦） | P2 | 未實作 | — |
| FR-017 | 小房東版：多物件、到期提醒 | P2 | 未實作 | — |
| FR-018 | 公開 API rate limit（沿用 `src/lib/rate-limit.ts`） | P1 | 已實作（目前只套在黑名單 POST） | rental-aggregator |
| FR-019 | 雙方陳述、管理員審核、完整姓名付費查詢（舊版） | — | **不做**（隨黑名單下架） | — |

## 7. 非功能需求

| 類別 | 需求 |
|---|---|
| 隱私 | M1 屋況清單與租約資料只存在使用者瀏覽器（localStorage），不送伺服器；不收集 IP 當識別碼 |
| 可及性 | 表單有 label、可鍵盤操作；色彩對比 WCAG AA（沿用現有設計準則） |
| 列印 | 屋況清單與租約草稿在 A4 列印時不截斷欄位 |
| 效能 | 首頁與工具頁在一般 4G 下可互動時間合理（具體門檻待 M2 量測後訂） |
| 安全 | 沿用 `vercel.json` 安全標頭；新增任何接受 URL 的欄位需限 http(s) |
| 品質 | lint、typecheck、test（coverage ≥ 70%）、build 全部在 CI 必過才可合併 |

## 8. 資料、個資、法規與風險

### 8.1 黑名單為何下架

| 風險 | 說明 |
|---|---|
| 名譽與誹謗 | 對可識別的特定房東公開指控，可能涉及刑法誹謗罪與民法名譽侵權；「雙方陳述」「管理員審核」無法免除平台責任。具體責任範圍需律師確認。 |
| 個資 | 遮罩後的「姓＋末字＋行政區（＋鄰）」仍可能間接識別特定人；`landlordNameFull` 以明文保存第三人完整姓名；以 IP 當使用者 ID 與 email。 |
| **假資料冒充真實檢舉** | 正式站公開的 804 筆是程式生成，但頁面寫「Dcard 公開黑特文章（去識別化後採用）+ 群眾協作檢舉」，看起來像真實指控。若真實存在同姓、同區的房東，可能被誤認。**建議立即下架**，此為 Sean 在 Vercel 的操作，不在本 PR 範圍。 |
| 營運負擔 | 審核、申訴、刪除請求需要人力與法律顧問（首頁「律師顧問招募中」）。 |

### 8.2 平台資料與服務條款

- 主 repo **沒有**爬取 591 或其他平台；首頁只有「591 不會告訴你的事」標語（M1 一併移除，避免引用他牌）。
- `rental-house-aggregator` PRD 規劃爬 591／樂屋網、並自動刊登到 591／FB 社團：**不併入、不實作**。
- 591 服務條款是否禁止自動擷取：**待確認**（本次未取得條款全文）。2026-11-16 取得的 `591.com.tw/robots.txt` 只封鎖 YandexBot，但 robots.txt 不等於授權，仍應以服務條款與律師意見為準。
- 結論：本產品**不取得任何第三方平台房源資料**，看房比較只用使用者自己輸入的資料。

### 8.3 租約產生器

- 依據：內政部公告之住宅租賃定型化契約應記載及不得記載事項、租賃住宅市場發展及管理條例（押金上限 2 個月租金等規則）。每條規則需在實作時附上條文出處，並由律師或官方文件覆核後才可移除「需人工覆核」標示。
- 界線：只做「依範本填空＋規則提示」，不做個案法律建議；頁面需標示非法律意見。是否涉及律師法對法律事務的限制：待確認。

### 8.4 資料分級（M1）

| 資料 | 位置 | 處理 |
|---|---|---|
| 屋況清單、照片描述 | 瀏覽器 localStorage | 提供一鍵清除 |
| 租約草稿（雙方姓名、地址、金額） | 瀏覽器 localStorage | 範例一律假資料（姓名加「示範」、電話 0900-000-xxx） |
| 伺服器端 | 無 | M1 不新增任何寫入 API |

## 9. 里程碑

| 里程碑 | 範圍 | 進入條件 |
|---|---|---|
| **M1 轉向與本機工具** | FR-001～FR-008：下架黑名單、屋況清單（入住／退租對照）、租約草稿與規則檢查、免責聲明、品質閘門修復 | Sean 決定採方案 (a)；見 `GOAL.md` |
| M2 帳號與存證 | FR-009～FR-014：規則說明頁、看房比較（搬 `rental-matcher`）、測試環境帳號、照片上傳（測試 bucket）、PDF；找 5–10 位租屋族試用 | M1 通過；律師覆核租約規則 |
| M3 付費與小房東版 | FR-015～FR-017：金流測試模式 → Sean 核准後正式、押金信託資訊、小房東版 | M2 試用回饋顯示有付費意願 |

## 10. 成功指標

| 階段 | 指標 | 目標 |
|---|---|---|
| M1 | CI 四個檢查全綠；`src` 內無黑名單字樣；清單與租約核心邏輯有單元測試 | 全部達成 |
| M2 | 試用者完成一次完整入住檢查的比例；願意付費的受訪比例 | 數字待 Sean 訂 |
| M3 | 單次購買轉換率、小房東版付費數 | 待 M2 結果後訂 |

## 11. 合併清單

| 來源 | 功能 | 決定 | 原因 |
|---|---|---|---|
| `rental-matcher` | 物件比較表（`ComparePage`） | **搬（M2，改寫）** | 概念可用於「看房比較」，但資料改為使用者輸入；不搬寫死的物件與「業務」欄位 |
| `rental-matcher` | 收藏（`toggleFavorite`） | 搬（M2，改寫） | 與比較表一起，改為 Next.js 元件並補測試 |
| `rental-matcher` | 看屋行程（`ViewingsPage`） | 搬（P2） | 目前只能新增固定 mock，需重寫表單 |
| `rental-matcher` | 訊息頁、物件總覽 | 不搬 | 訊息為寫死假對話；物件總覽需要房源資料，會導向爬蟲 |
| `rental-matcher` | Vite／Tailwind 4／react-router 技術棧 | 不搬 | 主 repo 是 Next.js + Tailwind 3，避免兩套 |
| `home-finder` | 全部 | 不搬 | 只有計數器範本；Leaflet 地圖不在 M1–M2 範圍 |
| `rental-house-aggregator` | 多平台統一搜尋、爬蟲、一鍵刊登 | **不搬** | 平台條款與法律風險，與本產品「不取得第三方房源」原則衝突 |
| `rental-house-aggregator` | 假房源過濾概念 | 不搬 | 需要房源資料 |
| 主 repo 自身 | `rate-limit.ts`、Zod 驗證樣板、安全標頭、Vitest 設定 | 保留 | M2 有 API 時沿用 |
| 主 repo 自身 | `BlacklistEntry`、`blacklist.json`、`mask.ts`、黑名單 API 與元件 | 移除（M1） | 見 §8.1 |

三個候選 repo 是否封存：由 Sean 決定，本 PR 不動。

## 12. 驗證方式

| 檢查 | 指令（來自 `package.json`） | 現況 |
|---|---|---|
| Lint | `npm run lint` | CI 通過 |
| 型別 | `npm run typecheck` | CI 未執行到（build job 被跳過） |
| 測試 | `npm test`；覆蓋率 `npm run test:coverage` | CI 失敗（rollup 原生模組） |
| 建置 | `npm run build` | CI 未執行到 |
| E2E | 尚未配置 | — |

## 13. README 與程式不符清單

| # | README／文件寫的 | 程式實況 |
|---|---|---|
| 1 | README 技術棧 Next.js 15.1、badge `Next.js-15.1.0` | `package.json` 為 `next@16.3.0` |
| 2 | 「預載 1,000 筆黑名單」；`/api/health` note 也寫 1,000 筆 | `blacklist.json` 實為 804 筆（seed 產 1,000、只匯出 approved） |
| 3 | CI badge、「PR 必須 green CI」 | 最近 7 次 CI 全部失敗，build／deploy 從未執行 |
| 4 | README：CI 跑 db:generate → typecheck → test → build；SOP：單一 job、Node 22、權限只有 `contents: read` | 實際為 lint／test／build／deploy 4 job、Node 20，權限含 `pages: write`、`id-token: write` |
| 5 | 107 tests、coverage 97.16% | grep 計 111 個測試呼叫；route.ts 被排除於 coverage；本機未執行，無法確認數字 |
| 6 | 首頁 footer「資料來源：Dcard 公開黑特文章（去識別化後採用）+ 群眾協作檢舉」 | 資料為 `seed.ts` 程式生成；`seed.ts` 與 AGENTS.md 明文不爬 Dcard |
| 7 | 首頁「提交檢舉」按鈕、導覽「信託」 | `/submit` 頁不存在；`#trust` 錨點不存在 |
| 8 | 首頁宣稱屋況清單 30 項、內政部 2026 版租約、5 家銀行信託方案 | 皆無程式 |
| 9 | README「完整姓名僅 Pro 用戶才能看（M3）」 | 無 Pro 機制；Prisma 模式以明文存 `landlordNameFull` |
| 10 | 舊 SPEC P0-1「預載 1,000 筆（從 Dcard 爬蟲公開資料 + 手動）」 | 與 AGENTS.md「不要爬 Dcard」矛盾；實際為合成資料 |
| 11 | README「Vercel 手動部署（沒有 GitHub webhook）」 | CI 有 `deploy` job（vercel-action），因前置失敗從未執行 |
| 12 | `package.json` description「黑名單 + 屋況清單 + 租約產生器 + 押金信託比較」 | 只有黑名單 |
| 13 | `eslint.config.mjs` 匯入 `@typescript-eslint/parser`／`eslint-plugin` | 未列在 devDependencies，靠間接相依，鎖檔變動時可能失效 |
| 14 | 舊 SPEC Live 網址只列 `-three` | 實際另有 `-sean` 別名，兩者皆在線 |

## 14. 待 Sean 決定

1. **正式站是否立即下架黑名單**（建議：是，今天就做；可先把 Vercel 專案下線或部署一個只有「維護中」的版本）。
2. 方向：(a) 本 repo 做 M1 轉向保留為導流工具；(b) 租約功能併入 `contract-reviewer`／`contract-tracker`；(c) 封存。
3. 產品名稱：「防雷網」帶有黑名單聯想，轉向後是否改名（例如「租屋點交與租約小幫手」，待定）。
4. 三個候選 repo 是否封存（本 PR 不動）。
5. 是否請律師覆核租約規則與免責文字（M2 進入條件）。
6. 是否移除 `BUILD_REPORT.md`、`PLAN.md`、`SECURITY_FINDINGS.md`、`rpb-*.log`、`dashboard.html` 等歷史檔（本 PR 不動）。
