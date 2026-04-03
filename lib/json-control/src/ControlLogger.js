/**
 * ControlLogger.js — browser-side conditional logger for the json-control library.
 *
 * Mirrors the interface of db/logger.cjs but runs in the browser as a native
 * ES module. No build step required.
 *
 * Log level is read dynamically from globalThis.dudezilla.logLevel on every
 * call so it can be changed at runtime without reloading the page:
 *
 *   globalThis.dudezilla.logLevel = 'debug'  // show everything
 *   globalThis.dudezilla.logLevel = 'warning' // only warnings + critical
 *
 * Levels (lowest → highest):
 *   debug    Verbose tracing (construction, key lookups, event flow)
 *   message  Normal operational events (test run started, PASS/FAIL)
 *   warning  Recoverable problems (element not found, key miss)
 *   critical Unrecoverable failures (invalid config, unknown control type)
 *
 * Every log call also POSTs to /api/logs (fire-and-forget, never throws).
 */

var LEVELS = { debug: 0, message: 1, warning: 2, critical: 3 }

var CONSOLE = {
  debug:    console.log.bind(console),
  message:  console.log.bind(console),
  warning:  console.warn.bind(console),
  critical: console.error.bind(console),
}

// ── Level resolution ──────────────────────────────────────────────────────────

function _minLevel () {
  try {
    var lvl = globalThis.dudezilla && globalThis.dudezilla.logLevel
    var n   = LEVELS[lvl]
    return n !== undefined ? n : LEVELS.message
  } catch (_) {
    return LEVELS.message
  }
}

// ── Persistence (fire-and-forget) ─────────────────────────────────────────────

function _post (level, context, msg, detail) {
  try {
    fetch('/api/logs', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        level:   level,
        context: context,
        message: msg,
        detail:  detail !== undefined ? detail : null,
      }),
    }).catch(function () {})
  } catch (_) {}
}

// ── Core ──────────────────────────────────────────────────────────────────────

/**
 * Write a structured log entry.
 *
 * @param {'debug'|'message'|'warning'|'critical'} level
 * @param {string} context  e.g. 'Control.applyHandlers', 'TestHarnessControl._run'
 * @param {string} msg      Human-readable description
 * @param {*}      [detail] Any JSON-serialisable value
 */
function log (level, context, msg, detail) {
  var lvlNum = LEVELS[level]
  if (lvlNum === undefined) lvlNum = LEVELS.message
  if (lvlNum < _minLevel()) return

  var now    = new Date().toISOString()
  var prefix = '[' + level.toUpperCase() + '] ' + now + ' [' + context + ']'
  var fn     = CONSOLE[level] || console.log

  if (detail !== undefined) {
    fn(prefix, msg, detail)
  } else {
    fn(prefix, msg)
  }

  _post(level, context, msg, detail)
}

// ── Convenience wrappers ──────────────────────────────────────────────────────

var debug    = function (ctx, msg, d) { log('debug',    ctx, msg, d) }
var message  = function (ctx, msg, d) { log('message',  ctx, msg, d) }
var warning  = function (ctx, msg, d) { log('warning',  ctx, msg, d) }
var critical = function (ctx, msg, d) { log('critical', ctx, msg, d) }

export { LEVELS, log, debug, message, warning, critical }
