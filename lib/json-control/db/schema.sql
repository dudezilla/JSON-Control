-- SQLite schema for JSON-Control test metadata
-- Applied automatically by db.js on first run.

CREATE TABLE IF NOT EXISTS test_runs (
  id          TEXT    PRIMARY KEY,          -- UUID (crypto.randomUUID)
  ran_at      TEXT    NOT NULL,             -- ISO-8601 UTC
  commit_hash TEXT    NOT NULL,             -- git rev-parse HEAD
  branch      TEXT,                         -- git rev-parse --abbrev-ref HEAD
  synced      INTEGER NOT NULL DEFAULT 0    -- 0 = pending Supabase push
);

-- One row per individual Jest test assertion.
CREATE TABLE IF NOT EXISTS test_results (
  id            TEXT    PRIMARY KEY,
  run_id        TEXT    NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,

  -- Identity
  control_name  TEXT    NOT NULL,           -- e.g. 'RangeControl'
  test_name     TEXT    NOT NULL,           -- full Jest test title

  -- Outcome
  passed        INTEGER NOT NULL CHECK (passed IN (0, 1)),
  duration_ms   REAL    NOT NULL,
  error_message TEXT,                       -- NULL when passed

  -- Git provenance — retrieve file with: git cat-file blob <hash>
  source_file   TEXT    NOT NULL,           -- relative path to src file
  source_blob   TEXT    NOT NULL,           -- git blob hash of source_file
  test_file     TEXT    NOT NULL,           -- relative path to test file
  test_blob     TEXT    NOT NULL,           -- git blob hash of test_file

  synced        INTEGER NOT NULL DEFAULT 0  -- 0 = pending Supabase push
);

CREATE INDEX IF NOT EXISTS idx_results_control ON test_results (control_name);
CREATE INDEX IF NOT EXISTS idx_results_run     ON test_results (run_id);

-- Structured log entries from the test pipeline (reporter, sync, db).
-- Written by logger.js; synced to Supabase by sync.js.
CREATE TABLE IF NOT EXISTS logs (
  id          TEXT    PRIMARY KEY,
  logged_at   TEXT    NOT NULL,
  level       TEXT    NOT NULL CHECK (level IN ('DEBUG','MESSAGE','WARNING','CRITICAL')),
  context     TEXT    NOT NULL,     -- module/function that logged, e.g. 'sync', 'reporter'
  message     TEXT    NOT NULL,
  detail      TEXT,                 -- JSON string (serialised args, timing, error info, etc.)
  instance_id TEXT,                 -- UUID set once per server start or Jest run
  synced      INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_logs_level   ON logs (level);
CREATE INDEX IF NOT EXISTS idx_logs_context ON logs (context);
-- idx_logs_instance_id is created by the migration in db.cjs / logger.cjs
-- so it works on both fresh and pre-existing databases.
