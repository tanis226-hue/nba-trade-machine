import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Public deployment URLs are captured at build time; Netlify only guarantees URL/SITE_ID
  // in function runtime. Never infer trusted origins from caller-supplied proxy headers.
  env:{NBA_DEPLOY_ORIGINS:[process.env.DEPLOY_PRIME_URL??process.env.URL,process.env.DEPLOY_URL,...(process.env.CONTEXT==='production'?[process.env.URL]:[])].filter(Boolean).join(',')},
  outputFileTracingIncludes: {
    '/*': ['./data/seed/*.json', './data/overrides/*.json'],
  },
  outputFileTracingExcludes: {
    '/*': ['./.env*','./.git/**/*','./.netlify/**/*','./.trades/**/*','./scripts/**/*','./docs/**/*'],
  },
};

export default nextConfig;
