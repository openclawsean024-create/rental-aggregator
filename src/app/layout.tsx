import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "台灣租屋防雷網 — 黑心房東黑名單 + 屋況清單 + 租約產生器",
  description:
    "591 不會告訴你的事：黑心房東黑名單 + 屋況檢查清單 + 定型化租約產生器 + 押金信託比較。專門幫租屋族避坑的一站式工具。",
  keywords: [
    "租屋黑名單",
    "黑心房東",
    "租屋防雷",
    "屋況檢查",
    "定型化租約",
    "押金信託",
  ],
  openGraph: {
    title: "台灣租屋防雷網",
    description: "591 不會告訴你的事：黑心房東黑名單 + 屋況清單 + 租約產生器",
    type: "website",
    locale: "zh_TW",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-Hant">
      <body className="bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
