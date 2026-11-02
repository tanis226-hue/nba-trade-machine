import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    '/*': ['./data/seed/*.json', './data/overrides/*.json'],
  },
  outputFileTracingExcludes: {
    '/*': ['./.env*','./.git/**/*','./.netlify/**/*','./.trades/**/*','./scripts/**/*','./docs/**/*'],
  },
};

export default nextConfig;
