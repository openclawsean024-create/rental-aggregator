import { BlacklistSearch } from "@/components/BlacklistSearch";
import { TopDistricts } from "@/components/TopDistricts";
import { ShieldAlert, Search, FileText, Home, CreditCard } from "lucide-react";

/**
 * M1 黑名單查詢頁 — 首頁
 *
 * 設計準則：
 * - 首屏資訊密度：hero 搜尋列 + 熱門風險區 TOP 5 + 最近 7 天新增（不 scroll）
 * - 色系：slate/indigo 為主，amber 警示，red-700 嚴重
 * - 字體：Inter + Noto Sans TC
 * - 互動：100ms transition + focus ring-2
 * - 信任感：footer 免責聲明 + 律師顧問 placeholder
 */
export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* ============ Header ============ */}
      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 group">
            <ShieldAlert className="h-5 w-5 text-brand-600" strokeWidth={2.25} />
            <span className="font-semibold text-slate-900">租屋防雷網</span>
            <span className="hidden sm:inline text-xs text-slate-400 ml-1">
              beta
            </span>
          </a>
          <nav className="flex items-center gap-1">
            <a href="#search" className="btn-ghost">查詢</a>
            <a href="#submit" className="btn-ghost">檢舉</a>
            <a href="#trust" className="btn-ghost hidden sm:inline-flex">信託</a>
          </nav>
        </div>
      </header>

      {/* ============ Hero ============ */}
      <section className="pt-16 pb-12 px-6">
        <div className="mx-auto max-w-3xl text-center">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 border border-brand-100">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-600" />
            591 不會告訴你的事
          </p>
          <h1 className="mt-4 text-4xl sm:text-5xl font-bold tracking-tight text-slate-900">
            找房前，先查房東。
          </h1>
          <p className="mt-4 text-base text-slate-600 leading-relaxed">
            群眾協作黑心房東資料庫 + 屋況檢查清單 + 定型化租約產生器 + 押金信託比較，
            <br className="hidden sm:inline" />
            專門幫台灣<span className="text-slate-900 font-medium">300 萬租屋族</span>避坑的一站式工具。
          </p>
        </div>
      </section>

      {/* ============ 搜尋框（黑名單查詢） ============ */}
      <section id="search" className="px-6 pb-12">
        <div className="mx-auto max-w-4xl">
          <BlacklistSearch />
        </div>
      </section>

      {/* ============ 統計：熱門風險區 + 最近 7 天 ============ */}
      <section className="px-6 pb-16">
        <div className="mx-auto max-w-6xl grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2">
            <h2 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-danger-700" />
              熱門風險區 TOP 5
            </h2>
            <TopDistricts />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-600" />
              為什麼要做這件事？
            </h2>
            <div className="card-listing">
              <div className="space-y-3">
                <div className="flex gap-3">
                  <Search className="h-4 w-4 text-brand-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-slate-900">黑名單資料庫</p>
                    <p className="text-xs text-slate-500">1,000+ 筆去識別化資料</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Home className="h-4 w-4 text-brand-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-slate-900">屋況檢查清單</p>
                    <p className="text-xs text-slate-500">30 項拍照存證</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <FileText className="h-4 w-4 text-brand-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-slate-900">定型化租約</p>
                    <p className="text-xs text-slate-500">內政部 2026 版</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <CreditCard className="h-4 w-4 text-brand-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-slate-900">押金信託比較</p>
                    <p className="text-xs text-slate-500">5 家銀行方案</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ 提交檢舉 CTA ============ */}
      <section id="submit" className="px-6 pb-16">
        <div className="mx-auto max-w-6xl">
          <div className="card-listing bg-gradient-to-br from-brand-50 to-white border-brand-100">
            <div className="flex flex-col sm:flex-row items-start gap-4 sm:items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  遇過黑心房東？幫其他人避雷
                </h3>
                <p className="text-sm text-slate-600 mt-1">
                  提交檢舉 → 進入管理員審核佇列（3-7 個工作天）→ 通過後公開
                </p>
              </div>
              <a href="/submit" className="btn-primary">
                <ShieldAlert className="h-4 w-4" />
                提交檢舉
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ============ Footer（信任感） ============ */}
      <footer className="mt-auto border-t border-slate-200 bg-white px-6 py-8">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-6 sm:grid-cols-3 text-sm">
            <div>
              <p className="font-semibold text-slate-900 mb-2">資料來源</p>
              <p className="text-xs text-slate-500 leading-relaxed">
                Dcard 公開黑特文章（去識別化後採用）+ 群眾協作檢舉。
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-900 mb-2">法律顧問</p>
              <div className="flex items-center gap-2">
                <div className="h-8 w-20 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-xs text-slate-400">
                  律師 logo
                </div>
                <span className="text-xs text-slate-400">（招募中）</span>
              </div>
            </div>
            <div>
              <p className="font-semibold text-slate-900 mb-2">免責聲明</p>
              <p className="text-xs text-slate-500 leading-relaxed">
                本站僅供參考，不承擔法律責任。 資料經管理員審核，僅顯示去識別化版本。
              </p>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <span>© 2026 租屋防雷網</span>
            <span>rental-aggregator-sean.vercel.app</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
