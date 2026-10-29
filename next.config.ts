import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  // 악보 파일(최대 4MB)을 Server Action으로 올린다
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
};

export default nextConfig;
