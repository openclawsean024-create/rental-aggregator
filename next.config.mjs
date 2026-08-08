/** @type {import('next').NextConfig} */
const nextConfig = {
  // PRD §4.5 graceful degradation: trailingSlash on API routes facilitates
  // server-rendered traps; pages keep clean URLs.
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // Server Actions are stable in 15; no flag needed.
  },
  // PRD §4.1 hosting: Vercel is the only target for now
  output: "standalone",
};

export default nextConfig;
