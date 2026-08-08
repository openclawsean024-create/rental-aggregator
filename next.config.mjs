/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // 不設 output: 'standalone' — Vercel 部署用 Next.js 預設 serverless mode
  // 設 standalone 會讓 serverless function 試圖跑自己的 server 而跟 Vercel runtime 衝突
};

export default nextConfig;
