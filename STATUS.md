# STATUS — 台灣租屋防雷網（暫定，rental-aggregator）

> 更新：2026-11-16｜本次為**文件重建（評估＋PRD v4.0＋M1 GOAL），尚未依新版開發任何程式**。
> 基準 commit：`d2a579c`（`main`）。本機無 node，lint／typecheck／test／build 皆未在本機執行。

## 1. 目前狀態

| 項目 | 狀態 |
|---|---|
| 建議 | **暫緩**（獲利潛力低；需 Sean 決定方向），但正式站黑名單應立即下架 |
| 完成度（依改版方向） | 15／100 |
| 正式站 | `rental-aggregator-three.vercel.app`、`rental-aggregator-sean.vercel.app` 在線，static 模式，公開 804 筆程式生成的假黑名單 |
| CI | 最近 7 次 push 全失敗（test job：`@rollup/rollup-linux-x64-gnu` 缺漏）；build、deploy 從未執行 |
| 已實作頁面 | 只有首頁 `/`（黑名單搜尋＋熱門區）；`/submit` 不存在 |
| 已實作 API | `GET/POST /api/blacklist`、`GET /api/blacklist/stats`、`GET /api/health` |
| 測試 | 8 個測試檔，grep 計 111 個測試呼叫（未在本機執行） |
| 爬蟲 | 無（主 repo 未爬 591／Dcard） |

## 2. FR 對照（PRD v4.0 §6）

| FR | 名稱 | 優先 | 狀態 | 所在 |
|---|---|---|---|---|
| FR-001 | 下架黑名單 | P0 | 未實作 | rental-aggregator |
| FR-002 | 屋況檢查清單範本 | P0 | 未實作（空資料表 `Inspection`） | rental-aggregator |
| FR-003 | 入住／退租對照 | P0 | 未實作 | — |
| FR-004 | 本機保存、匯出、列印 | P0 | 未實作 | — |
| FR-005 | 租約草稿產生器 | P0 | 未實作（空資料表 `LeaseContract`） | rental-aggregator |
| FR-006 | 租約規則檢查 | P0 | 未實作 | — |
| FR-007 | 免責聲明 | P0 | 未實作（首頁有舊版免責文字） | — |
| FR-008 | 品質閘門 | P0 | 部分（workflow 存在但 test 長期失敗） | rental-aggregator |
| FR-009 | 押金與退租規則說明 | P1 | 未實作 | — |
| FR-010 | 看房比較與收藏 | P1 | 部分（寫死資料） | rental-matcher |
| FR-011 | 看房行程 | P2 | 部分（只能新增固定 mock） | rental-matcher |
| FR-012 | 帳號與雲端保存 | P1 | 未實作 | — |
| FR-013 | 照片上傳 | P1 | 未實作 | — |
| FR-014 | PDF 產出 | P1 | 未實作 | — |
| FR-015 | 付費解鎖 | P2 | 未實作 | — |
| FR-016 | 押金信託資訊 | P2 | 未實作 | — |
| FR-017 | 小房東版 | P2 | 未實作 | — |
| FR-018 | 公開 API rate limit | P1 | 已實作（套在黑名單 POST） | rental-aggregator |
| FR-019 | 黑名單雙方陳述／審核／付費查姓名 | — | 不做 | — |

## 3. M1 進度（GOAL.md）

| AC | 標題 | 狀態 |
|---|---|---|
| AC-001 | 品質閘門真正擋得住失敗 | 未開始 |
| AC-002 | 黑名單功能從程式下架 | 未開始 |
| AC-003 | 屋況檢查清單（本機） | 未開始 |
| AC-004 | 租約草稿產生器與規則提示 | 未開始 |
| AC-005 | 不送出、不保存使用者資料到伺服器 | 未開始 |
| AC-006 | 只用明顯假資料並顯示免責聲明 | 未開始 |
| AC-007 | 文件與程式一致 | 未開始 |

## 4. 已知風險

1. 正式站公開程式生成的假檢舉，且標示資料來源為「Dcard 公開黑特文章」：可能誤指真實房東，誹謗與個資風險。
2. Prisma 模式下 `POST /api/blacklist` 以明文存第三人完整姓名，並以 `anon-<IP>` 當使用者 ID 與 email；static 模式把整筆檢舉內容寫進伺服器 log。
3. 候選 repo `rental-house-aggregator` 的 PRD 規劃爬 591／樂屋網並自動刊登，不得併入。591 服務條款內容待確認。
4. README、SOP 與程式多處不一致（PRD §13，共 14 項）。

## 5. 待決事項（Sean）

1. 是否立即下架正式站黑名單（建議：是）。
2. 方向：(a) 本 repo 轉向本機工具；(b) 租約功能併入 `contract-reviewer`／`contract-tracker`；(c) 封存。
3. 轉向後是否改產品名稱。
4. `rental-matcher`、`home-finder`、`rental-house-aggregator` 是否封存。
5. 是否委請律師覆核租約規則與免責文字。
6. 是否清除舊版歷史檔（`BUILD_REPORT.md`、`PLAN.md`、`SECURITY_FINDINGS.md`、`rpb-*.log`、`dashboard.html`）。

## 6. 本次變更

- 改寫 `PRD/SPEC.md`（v4.0，含 §0 評估結論、合併清單、README 不符清單）、`GOAL.md`（新增）、`AGENTS.md`、`SOP.md`、`STATUS.md`。
- 未修改任何程式碼、設定、測試；未修改 `PRD/CHANGELOG.md`。
