import fs from 'node:fs';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';

// Apply the SQL schema to the Neon database. Idempotent enough for first setup;
// statements are split on ';' (no string literals contain semicolons in this schema).
// Run: DATABASE_URL=... npx tsx scripts/migrate.ts
async function main() {
  const url = process.env.DATABASE_URL ?? process.env.NETLIFY_DATABASE_URL;
  if (!url) throw new Error('Set DATABASE_URL (or NETLIFY_DATABASE_URL)');
  const sql = neon(url);
  const file = path.join(process.cwd(), 'supabase/migrations/0001_init.sql');
  const statements = fs
    .readFileSync(file, 'utf8')
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const stmt of statements) {
    await sql.query(stmt);
  }
  console.log(`applied ${statements.length} statements from 0001_init.sql`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
