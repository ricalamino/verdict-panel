import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // lib/prompts.server.ts reads prompts/*.md at runtime. Standalone tracing
  // can't see a dynamically built path, so include the directory explicitly
  // or the files are absent from the production image.
  outputFileTracingIncludes: {
    "/api/panel": ["./prompts/**/*.md"],
  },
};

export default nextConfig;
