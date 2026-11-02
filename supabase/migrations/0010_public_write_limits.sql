-- Shared across serverless instances; expired buckets are reset atomically on use.
CREATE TABLE IF NOT EXISTS public_write_limits (
  key text PRIMARY KEY,
  hits integer NOT NULL,
  reset_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS public_write_limits_reset_at_idx ON public_write_limits (reset_at);
