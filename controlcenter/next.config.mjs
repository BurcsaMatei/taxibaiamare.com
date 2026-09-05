// controlcenter/next.config.mjs

// ==============================
// Imports
// ==============================
import { createVanillaExtractPlugin } from "@vanilla-extract/next-plugin";

const withVanillaExtract = createVanillaExtractPlugin();

const IS_PROD = process.env.NODE_ENV === "production";

// ==============================
// Next.js config
// ==============================
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,

  // IMPORTANT (monorepo): allow importing from workspace packages outside /controlcenter
  experimental: {
    externalDir: true,
    optimizeCss: IS_PROD,
  },

  // IMPORTANT (monorepo + vanilla-extract): transpile workspace packages that export TS/.css.ts
  transpilePackages: ["@taxi/tokens", "@taxi/shared"],

  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [360, 640, 768, 1024, 1280, 1536, 1920],
    imageSizes: [48, 96, 160, 240, 320, 480, 640, 820],
    remotePatterns: process.env.NEXT_PUBLIC_ASSET_BASE
      ? (() => {
          try {
            const u = new URL(process.env.NEXT_PUBLIC_ASSET_BASE);
            return [
              {
                protocol: u.protocol.replace(":", ""),
                hostname: u.hostname,
                pathname: "/**",
              },
            ];
          } catch {
            return [];
          }
        })()
      : [],
  },

  modularizeImports: {
    "date-fns": { transform: "date-fns/{{member}}" },
    lodash: { transform: "lodash/{{member}}" },
    "lodash-es": { transform: "lodash-es/{{member}}" },
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "geolocation=(), camera=(), microphone=()" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

// ==============================
// Apply plugins
// ==============================
const finalConfig = withVanillaExtract(nextConfig);

// ==============================
// Export
// ==============================
export default finalConfig;
