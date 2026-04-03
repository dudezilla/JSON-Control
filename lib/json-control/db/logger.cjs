'use strict'

/**
 * logger.js — structured, levelled logger for the JSON-Control test pipeline.
 *
 * Levels (lowest → highest intensity):
 *   debug    Timing decorators, serialized function inputs/outputs
 *   message  Normal operational events (run started, sync complete)
 *   warning  Recoverable problems (blob hash missing, DB row skipped)
 *   critical Unrecoverable failures (DB open failed, sync threw)
 *
 * Control via env vars:
 *   JCLOG_LEVEL=debug|message|warning|critical  (default: message)
 *   JCTEST_DB=0                                 disables SQLite persistence
 *
 * Logs are written to:
 *   1. Console  (always, with colour-coded prefix)
 *   2. SQLite   (test-results.db → logs table, unless JCTEST_DB=0)
 *   3. Supabase (via db:sync — same unsynced/markSynced pattern as test results)
 */

const { randomUUID } = require('crypto')
const path = require('path')

// ── Level map ─────────────────────────────────────────────────────────────────

const LEVELS = { debug: 0, message: 1, warning: 2, critical: 3 }
const LABELS = { debug: 'DEBUG', message: 'MESSAGE', warning: 'WARNING', critical: 'CRITICAL' }

// ANSI colours for terminal readability
const COLOURS = {
  debug:    '\x1b[36m',  // cyan
  message:  '\x1b[32m',  // green
  warning:  '\x1b[33m',  // yellow
  critical: '\x1b[31m',  // red
}
const RESET = '\x1b[0m'

const envLevel  = (process.env.JCLOG_LEVEL || 'message').toLowerCase()
const MIN_LEVEL = LEVELS[envLevel] ?? LEVELS.message
const DB_OFF    = process.env.JCTEST_DB === '0'

// ── SQLite (own connection — avoids circular dep with db.js) ──────────────────

const DB_PATH = path.join(__dirname, '..', 'test-results.db')
let _db = null
let _instanceId = null

/** Set the instance ID written to every subsequent log row. Call once on startup. */
function setInstanceId (id) { _instanceId = id || null }

function getDb () {
  if (_db) return _db
  try {
    const Database = require('better-sqlite3')
    _db = new Database(DB_PATH)
    _db.pragma('journal_mode = WAL')
    _db.exec(`
      CREATE TABLE IF NOT EXISTS logs (
        id          TEXT    PRIMARY KEY,
        logged_at   TEXT    NOT NULL,
        level       TEXT    NOT NULL CHECK (level IN ('DEBUG','MESSAGE','WARNING','CRITICAL')),
        context     TEXT    NOT NULL,
        message     TEXT    NOT NULL,
        detail      TEXT,
        instance_id TEXT,
        synced      INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_logs_level       ON logs (level);
      CREATE INDEX IF NOT EXISTS idx_logs_context     ON logs (context);
      CREATE INDEX IF NOT EXISTS idx_logs_instance_id ON logs (instance_id);
    `)
    // Migrate existing DBs that predate the instance_id column
    var cols = _db.prepare('PRAGMA table_info(logs)').all()
    if (!cols.some(function (c) { return c.name === 'instance_id' })) {
      _db.exec('ALTER TABLE logs ADD COLUMN instance_id TEXT')
      _db.exec('CREATE INDEX IF NOT EXISTS idx_logs_instance_id ON logs (instance_id)')
    }
  } catch (e) {
    _db = null
    console.error('[logger] Could not open SQLite:', e.message)
  }
  return _db
}

// ── Serialiser ────────────────────────────────────────────────────────────────

/**
 * Safely serialise any value for log storage.
 * Handles circular references, functions, Errors, and deep objects.
 * @param {*} value
 * @param {number} [maxDepth=4]
 */
function serialize (value, maxDepth) {
  if (maxDepth === undefined) maxDepth = 4
  var seen = new Set()
  try {
    return JSON.parse(
      JSON.stringify(value, function replacer (key, val) {
        if (typeof val === 'function') return '[Function: ' + (val.name || 'anonymous') + ']'
        if (val instanceof Error) return { __error: true, message: val.message, stack: val.stack }
        if (val instanceof RegExp) return val.toString()
        if (typeof val === 'object' && val !== null) {
          if (seen.has(val)) return '[Circular]'
          seen.add(val)
        }
        return val
      })
    )
  } catch (_) {
    return String(value)
  }
}

// ── Core log function ─────────────────────────────────────────────────────────

/**
 * Write a structured log entry.
 *
 * @param {'debug'|'message'|'warning'|'critical'} level
 * @param {string} context  Module or function name, e.g. 'sync', 'reporter.onRunStart'
 * @param {string} msg      Human-readable description
 * @param {*}      [detail] Any serialisable value — args, timing, error info, etc.
 */
function log (level, context, msg, detail, opts) {
  var lvlNum = LEVELS[level]
  if (lvlNum === undefined) lvlNum = LEVELS.message
  if (lvlNum < MIN_LEVEL) return

  var now    = new Date().toISOString()
  var label  = LABELS[level] || 'MESSAGE'
  var colour = COLOURS[level] || ''

  // ── Console ─────────────────────────────────────────────────────────────────
  var prefix = colour + '[' + label + ']' + RESET + ' ' + now + ' [' + context + ']'
  if (detail !== undefined) {
    var detailStr = typeof detail === 'object' ? JSON.stringify(detail) : String(detail)
    ;(level === 'critical' ? console.error : level === 'warning' ? console.warn : console.log)(
      prefix, msg, detailStr
    )
  } else {
    ;(level === 'critical' ? console.error : level === 'warning' ? console.warn : console.log)(
      prefix, msg
    )
  }

  // ── SQLite ──────────────────────────────────────────────────────────────────
  if (DB_OFF) return
  var db = getDb()
  if (!db) return

  try {
    db.prepare(
      'INSERT INTO logs (id, logged_at, level, context, message, detail, instance_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(
      randomUUID(),
      now,
      label,
      context,
      msg,
      detail !== undefined ? JSON.stringify(serialize(detail)) : null,
      (opts && opts.instanceId !== undefined) ? opts.instanceId : _instanceId
    )
  } catch (_) {
    // Never let logger errors propagate into caller
  }
}

// ── Convenience wrappers ──────────────────────────────────────────────────────

var debug    = function (ctx, msg, d) { log('debug',    ctx, msg, d) }
var message  = function (ctx, msg, d) { log('message',  ctx, msg, d) }
var warning  = function (ctx, msg, d) { log('warning',  ctx, msg, d) }
var critical = function (ctx, msg, d) { log('critical', ctx, msg, d) }

// ── timed() decorator ─────────────────────────────────────────────────────────

/**
 * Wrap a function to log exact start/end times and serialised inputs at DEBUG level.
 * Works for both synchronous and async (Promise-returning) functions.
 *
 * Example:
 *   const timedInsertRun = timed(insertRun, 'db')
 *   timedInsertRun({ commitHash: '…', branch: 'main' })
 *
 * @param {Function} fn       The function to wrap
 * @param {string}   context  Label used in log entries
 * @returns {Function}
 */
function timed (fn, context) {
  var name = fn.name || 'anonymous'
  return function timedWrapper () {
    var args  = Array.prototype.slice.call(arguments)
    var start = Date.now()
    var startIso = new Date(start).toISOString()

    debug(context, 'call:' + name, {
      at:   startIso,
      args: args.map(function (a) { return serialize(a) }),
    })

    var result
    try {
      result = fn.apply(this, arguments)
    } catch (err) {
      critical(context, 'throw:' + name, {
        durationMs: Date.now() - start,
        error:      err.message,
        stack:      err.stack,
      })
      throw err
    }

    // Async branch
    if (result && typeof result.then === 'function') {
      return result.then(
        function (val) {
          debug(context, 'return:' + name, {
            durationMs: Date.now() - start,
            result:     serialize(val),
          })
          return val
        },
        function (err) {
          critical(context, 'reject:' + name, {
            durationMs: Date.now() - start,
            error:      err.message,
            stack:      err.stack,
          })
          throw err
        }
      )
    }

    // Sync branch
    debug(context, 'return:' + name, {
      durationMs: Date.now() - start,
      result:     serialize(result),
    })
    return result
  }
}

// ── Sync helpers (used by sync.js) ────────────────────────────────────────────

/** Return all log rows not yet pushed to Supabase. */
function getUnsyncedLogs () {
  var db = getDb()
  if (!db) return []
  return db.prepare('SELECT * FROM logs WHERE synced = 0 ORDER BY logged_at').all()
}

/** Mark a batch of log rows as synced by their ids. */
function markLogsSynced (ids) {
  if (!ids || ids.length === 0) return
  var db = getDb()
  if (!db) return
  var placeholders = ids.map(function () { return '?' }).join(',')
  var stmt = db.prepare('UPDATE logs SET synced = 1 WHERE id IN (' + placeholders + ')')
  stmt.run.apply(stmt, ids)
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  log,
  debug,
  message,
  warning,
  critical,
  timed,
  serialize,
  setInstanceId,
  getUnsyncedLogs,
  markLogsSynced,
  LEVELS,
}
