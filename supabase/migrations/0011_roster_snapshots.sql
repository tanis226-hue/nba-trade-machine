CREATE TABLE IF NOT EXISTS roster_snapshots (
  season text PRIMARY KEY,
  version text NOT NULL,
  payload jsonb NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now()
);
