import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

// Turbopack 可能会误判 workspace root（例如被上层目录的 lockfile 干扰），从而尝试读取无权限目录导致构建/启动失败。
const turbopackRoot = fileURLToPath(new URL(".", import.meta.url));
const isCloudflarePagesStaticBuild = process.env.CF_PAGES_STATIC_BUILD === "1";

const nextConfig: NextConfig = {
  // Keep the normal Node.js server build unchanged; Pages builds export static assets.
  output: isCloudflarePagesStaticBuild ? "export" : undefined,
  reactCompiler: true,
  turbopack: {
    root: turbopackRoot,
  },
  ...(!isCloudflarePagesStaticBuild && {
    async headers() {
      return [
        { source: '/pdfjs/:path*.mjs', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
      ];
    },
  }),
};

export default nextConfig;
