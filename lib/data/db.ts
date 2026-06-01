import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

// Neon serverless Postgres over HTTP (edge/serverless friendly). Netlify's native Neon
// integration injects NETLIFY_DATABASE_URL; a plain DATABASE_URL also works (local, CI).
const url = process.env.DATABASE_URL ?? process.env.NETLIFY_DATABASE_URL;

let client: NeonQueryFunction<false, false> | null = null;

export function hasDb(): boolean {
  return Boolean(url);
}

export function db(): NeonQueryFunction<false, false> {
  if (!url) throw new Error('No database URL set (DATABASE_URL or NETLIFY_DATABASE_URL)');
  if (!client) client = neon(url);
  return client;
}
