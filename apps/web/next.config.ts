import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@owasp/scanner-core"],
  serverExternalPackages: ["@owasp/scanner-core"],
  outputFileTracingRoot: path.join(__dirname, "../.."),
};

export default nextConfig;
