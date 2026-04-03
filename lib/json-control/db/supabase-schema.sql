-- Supabase (PostgreSQL) schema for JSON-Control test metadata.
-- Run this once in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- The sync script (pnpm db:sync) pushes local SQLite rows here.

CREATE TABLE IF NOT EXISTS test_runs (
  id          TEXT        PRIMARY KEY,
  ran_at      TIMESTAMPTZ NOT NULL,
  commit_hash TEXT        NOT NULL,
  branch      TEXT
);

CREATE TABLE IF NOT EXISTS test_results (
  id            TEXT             PRIMARY KEY,
  run_id        TEXT             NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,

  control_name  TEXT             NOT NULL,
  test_name     TEXT             NOT NULL,

  passed        BOOLEAN          NOT NULL,
  duration_ms   DOUBLE PRECISION NOT NULL,
  error_message TEXT,

  source_file   TEXT             NOT NULL,
  source_blob   TEXT             NOT NULL,
  test_file     TEXT             NOT NULL,
  test_blob     TEXT             NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_results_control ON test_results (control_name);
CREATE INDEX IF NOT EXISTS idx_results_run     ON test_results (run_id);

-- Structured log entries synced from the local SQLite DB.
CREATE TABLE IF NOT EXISTS logs (
  id          TEXT        PRIMARY KEY,
  logged_at   TIMESTAMPTZ NOT NULL,
  level       TEXT        NOT NULL CHECK (level IN ('DEBUG','MESSAGE','WARNING','CRITICAL')),
  context     TEXT        NOT NULL,
  message     TEXT        NOT NULL,
  detail      JSONB,
  instance_id TEXT                  -- UUID set once per server start or Jest run
);

CREATE INDEX IF NOT EXISTS idx_logs_level       ON logs (level);
CREATE INDEX IF NOT EXISTS idx_logs_context     ON logs (context);
CREATE INDEX IF NOT EXISTS idx_logs_instance_id ON logs (instance_id);

-- Migration for existing Supabase tables (run once if the table already exists):
-- ALTER TABLE logs ADD COLUMN IF NOT EXISTS instance_id TEXT;
-- CREATE INDEX IF NOT EXISTS idx_logs_instance_id ON logs (instance_id);

-- Useful views -----------------------------------------------------------

-- Average duration and pass-rate per control across all runs
CREATE OR REPLACE VIEW v_control_summary AS
SELECT
  control_name,
  COUNT(*)                                        AS total_tests,
  ROUND(AVG(duration_ms)::numeric, 2)             AS avg_ms,
  ROUND(MIN(duration_ms)::numeric, 2)             AS min_ms,
  ROUND(MAX(duration_ms)::numeric, 2)             AS max_ms,
  ROUND((AVG(passed::int) * 100)::numeric, 1)     AS pass_pct
FROM test_results
GROUP BY control_name
ORDER BY avg_ms DESC;

-- Test results joined with their run metadata (for trend queries)
CREATE OR REPLACE VIEW v_results_with_run AS
SELECT
  r.ran_at,
  r.commit_hash,
  r.branch,
  t.control_name,
  t.test_name,
  t.passed,
  t.duration_ms,
  t.error_message,
  t.source_file,
  t.source_blob,
  t.test_file,
  t.test_blob
FROM test_results t
JOIN test_runs r ON t.run_id = r.id;
