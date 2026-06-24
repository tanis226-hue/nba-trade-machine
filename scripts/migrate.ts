import fs from 'node:fs';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';

// Tracked, idempotent migration runner. Applies every supabase/migrations/*.sql in sorted order
// exactly once, recording each in schema_migrations. Statement execution tolerates "already
// exists / duplicate" errors so a DB whose 0001 was applied by the old runner (untracked) is
// reconciled cleanly. Run: DATABASE_URL=... npx tsx scripts/migrate.ts

// Postgres SQLSTATEs that mean "this object already exists" — safe to ignore for additive DDL.
const IGNORABLE = new Set(['42P07', '42701', '42710', '42P06', '42723', '42P16', '42704']);

function splitStatements(sql: string): string[] {
  // Strip line + inline -- comments first so a ';' inside a comment never splits a statement.
  // (Our migrations contain no string literals with '--'.)
  const noComments = sql
    .split('\n')
    .map((line) => {
      const i = line.indexOf('--');
      return i >= 0 ? line.slice(0, i) : line;
    })
    .join('\n');
  return noComments
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

async function main() {
  const url = process.env.DATABASE_URL ?? process.env.NETLIFY_DATABASE_URL;
  if (!url) throw new Error('Set DATABASE_URL (or NETLIFY_DATABASE_URL)');
  const sql = neon(url);

  await sql.query('create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())');
  const applied = new Set(
    (await sql.query('select name from schema_migrations')).map((r: Record<string, unknown>) => r.name as string),
  );

  const dir = path.join(process.cwd(), 'supabase/migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

  let total = 0;
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`skip ${file} (already applied)`);
      continue;
    }
    const statements = splitStatements(fs.readFileSync(path.join(dir, file), 'utf8'));
    let ok = 0;
    for (const stmt of statements) {
      try {
        await sql.query(stmt);
        ok++;
      } catch (e) {
        const code = (e as { code?: string }).code;
        if (code && IGNORABLE.has(code)) continue; // already-exists: fine for additive DDL
        console.error(`\n${file} failed on:\n${stmt.slice(0, 200)}`);
        throw e;
      }
    }
    await sql.query('insert into schema_migrations (name) values ($1) on conflict do nothing', [file]);
    console.log(`applied ${file} (${ok}/${statements.length} statements)`);
    total++;
  }
  console.log(`done — ${total} new migration(s) applied`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
