# Goal — 台灣租屋防雷網（暫定）M1

> **建議暫緩，需 Sean 決定後才開發。** 評估結論見 `PRD/SPEC.md` §0：獲利潛力低、唯一已上線的黑名單功能需下架。本檔依「方案 (a)：本 repo 轉向為本機工具」撰寫；若 Sean 選擇併入合約產品或封存，本檔作廢。
> 例外：正式站下架黑名單不需等本檔核准，由 Sean 在 Vercel 操作（不在 M1 程式範圍）。

## Objective

在不處理真實個資、不取得任何第三方平台資料、不提供個案法律意見的前提下，把 repo 從「黑心房東黑名單」轉為兩個只在瀏覽器本機運作的工具：**屋況檢查清單**（入住／退租對照）與**租約草稿產生器**（含規則提示），並讓 lint／typecheck／test／build 在 CI 真正擋住失敗。

規格依據：`PRD/SPEC.md` v4.0（§6 FR-001～FR-008、§8 法規與風險、§9 M1）。

## Acceptance criteria

每條 AC 的「驗證」指令必須 exit 0。測試檔名為建議名稱，實作時可調整，但需同步更新本檔與 `SOP.md`。

- **AC-001：品質閘門真正擋得住失敗**（FR-008）
  - 修正 CI test job 的 `Cannot find module @rollup/rollup-linux-x64-gnu`（例如在 Linux 重新產生 `package-lock.json`，或明確加入對應 optional 相依），使 test 能在 CI 啟動。
  - CI 的 test job 改跑 `npm run test:coverage`，coverage 門檻（`vitest.config.ts` 現為 70%）不達即失敗；移除 `npm ci ... || npm install` 這種失敗後改用其他指令的寫法。
  - `eslint.config.mjs` 用到的 `@typescript-eslint/parser`、`@typescript-eslint/eslint-plugin` 明列在 devDependencies。
  - deploy job 只在 push 到 `main` 且 lint、test、build 全通過後執行；PR 不觸發部署。
  - 驗證：`npm run lint && npm run typecheck && npm run test:coverage && npm run build` 全部 exit 0；本 M1 的 PR 上 GitHub Actions 的 lint／test／build 三個 job 皆為綠燈；`grep -nE "\|\| npm install|continue-on-error: true|\|\| echo" .github/workflows/ci.yml` 無結果。

- **AC-002：黑名單功能從程式下架**（FR-001）
  - 刪除 `src/app/api/blacklist/**`、`src/data/blacklist.json`、`src/data/blacklist-store.ts`、`src/components/BlacklistSearch.tsx`、`src/components/TopDistricts.tsx`、`src/lib/mask.ts` 與對應測試；`scripts/export-seed-data.ts` 與 `prisma/seed.ts` 中的黑名單生成邏輯一併移除。
  - Prisma schema 移除 `BlacklistEntry` 與 `User.blacklistEntries`，新增 migration。
  - 首頁、`layout.tsx` metadata 與 `package.json` description 不再出現黑名單、黑心房東、檢舉、「591 不會告訴你的事」、「Dcard 公開黑特文章」等字樣。
  - `/api/health` 不再回報黑名單筆數。
  - 驗證：`git grep -nE "黑名單|黑心房東|檢舉|blacklist|landlordNameFull|591|Dcard" -- src prisma/schema.prisma prisma/seed.ts scripts package.json` 無結果；`npx prisma validate` exit 0；`npm test -- src/app/api/health` 通過且斷言回應不含 `totalEntries`。

- **AC-003：屋況檢查清單（本機）**（FR-002／FR-003／FR-004）
  - `src/lib/inspection.ts`（純函式）：內建範本至少涵蓋玄關、客廳、臥室、廚房、衛浴、陽台、水電、消防與安全 8 類；每項狀態為 `ok`／`defect`／`na`，可填備註與照片說明文字（M1 不上傳照片）。
  - 可建立「入住」與「退租」兩次檢查，`diffInspections()` 回傳退租時新增或加重的瑕疵。
  - 頁面 `/inspection`：填寫、本機保存（localStorage）、重新整理後保留、匯出 JSON、列印版面、一鍵清除本機資料。
  - 驗證：`npm test -- src/lib/inspection.test.ts`（涵蓋範本完整性、狀態驗證、diff 新增／未變／改善三種情況、空清單）；`npm test -- src/app/inspection`（Testing Library：填寫 → 重新 render 後資料仍在 → 清除後為空）。

- **AC-004：租約草稿產生器與規則提示**（FR-005／FR-006）
  - `src/lib/lease.ts`（純函式）：輸入雙方稱謂、物件地址、月租、押金、租期起訖、繳費日、修繕約定；`validateLease()` 回傳錯誤與警示清單，至少包含：押金超過 2 個月租金（警示）、必填欄位缺漏（錯誤）、結束日早於開始日（錯誤）、月租或押金非正整數（錯誤）。每條規則帶 `source`（法規或公告名稱）與 `needsReview: true`。
  - 頁面 `/lease`：表單 → 預覽草稿 → 瀏覽器列印；警示顯示在對應欄位旁。不產生 PDF、不送伺服器。
  - 驗證：`npm test -- src/lib/lease.test.ts`（每條規則至少一個通過與一個不通過案例；斷言每條規則都有 `source` 與 `needsReview`）；`npm test -- src/app/lease`（輸入押金 = 3 個月租金時畫面出現警示）。

- **AC-005：不送出、不保存任何使用者資料到伺服器**（PRD §8.4）
  - M1 新增的頁面與 lib 不呼叫 `fetch`、不新增任何 `src/app/api/**` 寫入端點；不以 IP 作為任何識別碼。
  - 驗證：`git grep -n "fetch(" -- src/lib/inspection.ts src/lib/lease.ts src/app/inspection src/app/lease` 無結果；`git grep -n "anon-" -- src` 無結果；`git grep -nE "export async function (POST|PUT|PATCH|DELETE)" -- src/app/api` 無結果；`npm test -- src/lib/no-network.test.ts`（以 mock `fetch` 跑完清單與租約流程，斷言呼叫次數為 0）。

- **AC-006：只用明顯假資料，並顯示免責聲明**（FR-007）
  - 所有範例、預設值、測試 fixture：姓名加「示範」或「測試」前綴、電話在 `0900-000-000`～`0900-000-999`、Email 使用 `@example.com`、地址使用「示範市示範區」。
  - 新增自動掃描測試：在 `src`、`prisma` 內找到不在假號碼範圍的 `09` 開頭手機號、非 `example.com` 的 Email 即失敗。
  - `/inspection` 與 `/lease` 頁尾顯示「本工具僅供整理資料，非法律意見；正式契約請以內政部公告範本為準並自行確認」，並附官方範本連結（網址於實作時查證）。
  - 驗證：`npm test -- src/lib/fixtures-safety.test.ts`；`npm test -- src/app/lease src/app/inspection` 斷言免責文字存在；`git grep -nIE "(sk_live|sk_test|AKIA[0-9A-Z]{12,}|ghp_[A-Za-z0-9]{20,}|-----BEGIN)" -- src prisma scripts .github .env.example` 無結果。

- **AC-007：文件與程式一致**（PRD §13）
  - README 改寫為轉向後的產品：技術棧版本與 `package.json` 一致、列出實際頁面與指令、移除未經 CI 驗證的測試數與 coverage badge、移除黑名單 API 契約。
  - `STATUS.md` 的 FR 對照表更新為 M1 實作結果。
  - 驗證：`git grep -nE "15\.1|1,000 筆|107 tests|97\.16" -- README.md` 無結果；Sean 覆審 README 一次。

## Out of scope

- 正式站下架、Vercel 設定或環境變數變更、自訂網域（由 Sean 操作）。
- 帳號登入（Clerk）、資料庫寫入、雲端同步、照片上傳（R2）、PDF 產出（M2）。
- 金流與付費牆（Stripe），任何正式或測試金鑰（M3 才用測試模式）。
- 押金信託比較、銀行方案資料（M3，只列官方公開資訊）。
- 爬取或串接 591、樂屋網、Dcard、FB 社團等任何第三方平台資料；房源搜尋、刊登。
- 看房比較與收藏（M2 自 `rental-matcher` 改寫搬入）。
- 公開的房東、房客或物件評價（任何 UGC 評價功能需先經律師評估）。
- 真實個資、真實租約、真實房屋照片；個案法律諮詢。
- 封存、刪除或改名 `rental-matcher`、`home-finder`、`rental-house-aggregator`。

## Exit gate

M1 開工前需 Sean 在 `PRD/SPEC.md` §14 第 2 點選定方案 (a)。M1 完成需：AC-001～AC-007 的驗證指令全部 exit 0、PR 上 CI 全綠、Sean 覆審首頁與兩個工具頁文案（特別是免責聲明與不再有黑名單字樣）。未通過不得進入 M2 的帳號、上傳或任何 production 資料流。
