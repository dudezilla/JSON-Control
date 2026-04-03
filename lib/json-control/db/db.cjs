'use strict'

const path = require('path')
const fs   = require('fs')
const { randomUUID } = require('crypto')
const Database = require('better-sqlite3')
const log = require('./logger.cjs')

const DB_PATH = path.join(__dirname, '..', 'test-results.db')
const SCHEMA  = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8')

let _db = null

function openDb () {
  if (_db) return _db
  try {
    _db = new Database(DB_PATH)
    _db.pragma('journal_mode = WAL')
    _db.pragma('foreign_keys = ON')
    _db.exec(SCHEMA)
    // Migrate: add instance_id column to logs if this is a pre-existing DB
    var logCols = _db.prepare('PRAGMA table_info(logs)').all()
    if (!logCols.some(function (c) { return c.name === 'instance_id' })) {
      _db.exec('ALTER TABLE logs ADD COLUMN instance_id TEXT')
      _db.exec('CREATE INDEX IF NOT EXISTS idx_logs_instance_id ON logs (instance_id)')
    }
    log.debug('db', 'openDb', { path: DB_PATH })
  } catch (err) {
    log.critical('db', 'openDb failed', { path: DB_PATH, error: err.message, stack: err.stack })
    throw err
  }
  return _db
}

// ── Writers ───────────────────────────────────────────────────────────────────

/**
 * Insert a new test run row.
 * @param {{ commitHash: string, branch: string }} opts
 * @returns {string} UUID of the inserted row
 */
function insertRun ({ commitHash, branch }) {
  try {
    const db  = openDb()
    const id  = randomUUID()
    const now = new Date().toISOString()
    db.prepare(
      'INSERT INTO test_runs (id, ran_at, commit_hash, branch) VALUES (?, ?, ?, ?)'
    ).run(id, now, commitHash, branch || null)
    log.debug('db', 'insertRun', { id, commitHash, branch })
    return id
  } catch (err) {
    log.critical('db', 'insertRun failed', { commitHash, branch, error: err.message })
    throw err
  }
}

/**
 * Insert one test-result row.
 *
 * @param {{
 *   runId: string,
 *   controlName: string,
 *   testName: string,
 *   passed: boolean,
 *   durationMs: number,
 *   errorMessage?: string,
 *   sourceFile: string,
 *   sourceBlob: string,
 *   testFile: string,
 *   testBlob: string,
 * }} result
 * @returns {string} UUID of the inserted row
 */
function insertResult (result) {
  try {
    const db = openDb()
    const id = randomUUID()
    db.prepare(`
      INSERT INTO test_results
        (id, run_id, control_name, test_name, passed, duration_ms, error_message,
         source_file, source_blob, test_file, test_blob)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      result.runId,
      result.controlName,
      result.testName,
      result.passed ? 1 : 0,
      result.durationMs,
      result.errorMessage || null,
      result.sourceFile,
      result.sourceBlob,
      result.testFile,
      result.testBlob
    )
    if (!result.passed) {
      log.warning('db', 'insertResult: test failed', {
        controlName: result.controlName,
        testName:    result.testName,
        durationMs:  result.durationMs,
        error:       result.errorMessage,
      })
    }
    return id
  } catch (err) {
    log.critical('db', 'insertResult failed', {
      controlName: result.controlName,
      testName:    result.testName,
      error:       err.message,
    })
    throw err
  }
}

// ── Sync helpers ──────────────────────────────────────────────────────────────

/** Return all runs not yet pushed to Supabase. */
function getUnsyncedRuns () {
  try {
    return openDb().prepare('SELECT * FROM test_runs WHERE synced = 0').all()
  } catch (err) {
    log.critical('db', 'getUnsyncedRuns failed', { error: err.message })
    throw err
  }
}

/** Return all results for a given run_id. */
function getResultsForRun (runId) {
  try {
    return openDb().prepare('SELECT * FROM test_results WHERE run_id = ?').all(runId)
  } catch (err) {
    log.critical('db', 'getResultsForRun failed', { runId, error: err.message })
    throw err
  }
}

/** Mark a run (and its results) as synced. */
function markRunSynced (runId) {
  try {
    const db = openDb()
    db.prepare('UPDATE test_results SET synced = 1 WHERE run_id = ?').run(runId)
    db.prepare('UPDATE test_runs SET synced = 1 WHERE id = ?').run(runId)
    log.debug('db', 'markRunSynced', { runId })
  } catch (err) {
    log.critical('db', 'markRunSynced failed', { runId, error: err.message })
    throw err
  }
}

// ── Quick-query CLI ───────────────────────────────────────────────────────────

/**
 * Simple helper for one-off SQL — used by `pnpm db:query`.
 * @param {string} sql
 */
function query (sql) {
  try {
    const rows = openDb().prepare(sql).all()
    console.table(rows)
  } catch (err) {
    log.critical('db', 'query failed', { sql, error: err.message })
    throw err
  }
}

module.exports = {
  openDb,
  insertRun,
  insertResult,
  getUnsyncedRuns,
  getResultsForRun,
  markRunSynced,
  query,
  DB_PATH,
}
