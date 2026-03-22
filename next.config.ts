import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // voyageai, pdf-parse, mammoth use CJS/native modules — exclude from Turbopack/webpack bundling
  serverExternalPackages: ['voyageai', 'pdf-parse', 'mammoth'],
};

export default nextConfig;
