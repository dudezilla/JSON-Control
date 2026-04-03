#!/usr/bin/env node
/**
 * serve.js — static dev server for the JSON-Control demo site.
 *
 * Serves both dist/ (the HTML shell) and src/ (the ES module source files).
 * The browser loads controls natively via <script type="module"> — no bundler.
 *
 * On startup, buildControlRegistry() imports every control module, reads each
 * .meta static property, and reads the source file from disk. The resulting
 * object is keyed by control_type and exposed as GET /api/control_registry.
 *
 * NOTE: shell.js now builds the registry client-side via build_registry.js and
 * /api/source/controls/. The /api/control_registry endpoint is retained as a
 * server-side convenience and for parity with direct API consumers.
 *
 * REST API
 * ────────
 *   GET  /api/control_registry              Full control registry (JSON)
 *                                             control_registry[controlType] = {
 *                                               controlType, category, description,
 *                                               defaultConfig, tests, srcCode }
 *   GET  /api/source/controls/              List all .js files in src/controls/
 *   GET  /api/source/controls/:file         Source of src/controls/<file> (text/plain)
 *   GET  /api/source/                       List all .js files in src/ top-level
 *   GET  /api/source/:file                  Source of any .js in src/ top-level (text/plain)
 *   GET  /api/logs                          Query log entries from SQLite
 *                                             ?control=  filter by control name (= context)
 *                                             ?context=  same as ?control
 *                                             ?level=    DEBUG|MESSAGE|WARNING|CRITICAL
 *                                             ?limit=    max rows (default 200, cap 1000)
 *   POST /api/logs                          Append a log entry to SQLite
 *                                             body JSON: { level, context, message, detail? }
 *
 * Static routes
 * ─────────────
 *   /            → dist/index.html
 *   /src/...     → src/...   (ES modules, served with application/javascript)
 *   anything else → dist/<path>
 *
 * Usage:
 *   node serve.js
 *   PORT=8080 node serve.js
 */

import http              from 'http'
import fs                from 'fs'
import path              from 'path'
import { randomUUID }    from 'crypto'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'

const INSTANCE_ID = randomUUID()

// ── Per-startup build version ─────────────────────────────────────────────────
// A fresh token is minted every time the server process starts.  JS modules
// are served under /src/v{BUILD_VER}/... so every deploy gets unique URLs,
// bypassing any intermediate proxy cache (including the Replit preview proxy)
// that might ignore Cache-Control: no-store for native ESM modules.
const BUILD_VER = Date.now().toString(36)

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require   = createRequire(import.meta.url)

const rootDir     = __dirname
const distDir     = path.join(rootDir, 'dist')
const srcDir      = path.join(rootDir, 'src')
const controlsDir = path.join(srcDir, 'controls')
const DB_PATH     = path.join(rootDir, 'test-results.db')

// ── Control registry (built on startup) ──────────────────────────────────────

var control_registry = {}

async function buildControlRegistry () {
  var files = fs.readdirSync(controlsDir)
    .filter(function (f) { return f.endsWith('.js') && f !== 'index.js' })
    .sort()

  for (var file of files) {
    try {
      var srcCode = fs.readFileSync(path.join(controlsDir, file), 'utf8')
      var mod     = await import(path.join(controlsDir, file))
      var Ctrl    = Object.values(mod).find(function (v) {
        return typeof v === 'function' && v.meta
      })
      if (!Ctrl) {
        console.warn('control_registry: no .meta found in', file)
        continue
      }
      var meta  = Ctrl.meta
      var tests = (meta.tests || []).map(function (t) {
        return { name: t.name, fn: t.fn.toString() }
      })
      control_registry[meta.controlType] = {
        controlType:   meta.controlType,
        category:      meta.category,
        description:   meta.description,
        defaultConfig: meta.defaultConfig,
        tests:         tests,
        srcCode:       srcCode,
      }
    } catch (err) {
      console.error('control_registry: failed to load ' + file + ':', err.message)
    }
  }
}

// ── Logger (CJS — used for writes) ───────────────────────────────────────────
var _logger = null
function getLogger () {
  if (_logger) return _logger
  try { _logger = require('./db/logger.cjs') } catch (_) {}
  return _logger
}

// ── SQLite read connection ────────────────────────────────────────────────────
var _db = null
function getDb () {
  if (_db) return _db
  try {
    var Database = require('better-sqlite3')
    if (!fs.existsSync(DB_PATH)) return null
    _db = new Database(DB_PATH, { readonly: true })
    return _db
  } catch (_) { return null }
}

function queryLogs (context, level, limit) {
  var db = getDb()
  if (!db) return []
  try {
    var sql  = 'SELECT id, logged_at, level, context, message, detail FROM logs WHERE 1=1'
    var args = []
    if (context) { sql += ' AND context = ?'; args.push(context) }
    if (level)   { sql += ' AND level = ?';   args.push(level.toUpperCase()) }
    sql += ' ORDER BY logged_at DESC LIMIT ?'
    args.push(limit)
    var rows = db.prepare(sql).all(...args)
    return rows.map(function (r) {
      var detail = r.detail
      if (detail) { try { detail = JSON.parse(detail) } catch (_) {} }
      return { id: r.id, logged_at: r.logged_at, level: r.level, context: r.context, message: r.message, detail }
    })
  } catch (_) { return [] }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.png':  'image/png',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
}

function json (res, status, data) {
  var body = JSON.stringify(data)
  res.writeHead(status, {
    'Content-Type':  'application/json; charset=utf-8',
    'Cache-Control': 'no-cache',
    'Access-Control-Allow-Origin': '*',
  })
  res.end(body)
}

function serveSource (res, filePath, baseDir) {
  if (!filePath.startsWith(baseDir)) {
    return json(res, 403, { error: 'Forbidden' })
  }
  fs.stat(filePath, function (err, stat) {
    if (err || !stat.isFile()) {
      return json(res, 404, { error: 'Not found', path: filePath.slice(rootDir.length) })
    }
    res.writeHead(200, {
      'Content-Type':  'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
    })
    fs.createReadStream(filePath).pipe(res)
  })
}

function serveFile (res, filePath) {
  fs.stat(filePath, function (statErr, stat) {
    if (statErr || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' })
      res.end('Not found: ' + filePath)
      return
    }
    var ext  = path.extname(filePath).toLowerCase()
    var mime = MIME[ext] || 'application/octet-stream'
    res.writeHead(200, {
      'Content-Type':  mime,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma':        'no-cache',
      'Access-Control-Allow-Origin': '*',
    })
    fs.createReadStream(filePath).pipe(res)
  })
}

function readBody (req, cb) {
  var chunks = []
  req.on('data', function (c) { chunks.push(c) })
  req.on('end', function () { cb(Buffer.concat(chunks).toString('utf8')) })
  req.on('error', function () { cb(null) })
}

// ── Server ────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '7777', 10)

const server = http.createServer(function (req, res) {
  var urlPath = req.url.split('?')[0]
  var method  = req.method.toUpperCase()

  // OPTIONS (CORS preflight)
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    })
    res.end()
    return
  }

  // ── GET /api/control_registry ─────────────────────────────────────────────
  if (method === 'GET' && urlPath === '/api/control_registry') {
    return json(res, 200, control_registry)
  }

  // ── GET /api/source/controls/          → list all .js files in src/controls/
  // ── GET /api/source/controls/:file     → source of one file
  if (method === 'GET' && urlPath.startsWith('/api/source/controls')) {
    var file = urlPath.slice('/api/source/controls'.length).replace(/^\//, '')

    if (!file) {
      try {
        var entries = fs.readdirSync(controlsDir).filter(function (f) { return f.endsWith('.js') }).sort()
        return json(res, 200, entries)
      } catch (e) {
        return json(res, 500, { error: e.message })
      }
    }

    if (file.includes('/') || !file.endsWith('.js')) {
      return json(res, 400, { error: 'Filename must be a single .js file' })
    }
    serveSource(res, path.join(controlsDir, file), controlsDir)
    return
  }

  // ── GET /api/source/          → list all .js files in src/ top-level
  // ── GET /api/source/:file     → source of one file
  if (method === 'GET' && urlPath.startsWith('/api/source')) {
    var file2 = urlPath.slice('/api/source'.length).replace(/^\//, '')

    if (!file2) {
      try {
        var entries2 = fs.readdirSync(srcDir).filter(function (f) { return f.endsWith('.js') && !fs.statSync(path.join(srcDir, f)).isDirectory() }).sort()
        return json(res, 200, entries2)
      } catch (e) {
        return json(res, 500, { error: e.message })
      }
    }

    if (file2.includes('/') || !file2.endsWith('.js')) {
      return json(res, 400, { error: 'Filename must be a single .js file with no path separators' })
    }
    serveSource(res, path.join(srcDir, file2), srcDir)
    return
  }

  // ── /api/logs ─────────────────────────────────────────────────────────────
  if (urlPath === '/api/logs') {

    // GET — query log entries
    if (method === 'GET') {
      var params  = new URLSearchParams(req.url.split('?')[1] || '')
      var context = params.get('control') || params.get('context') || null
      var level   = params.get('level')   || null
      var limit   = Math.min(parseInt(params.get('limit') || '200', 10), 1000)
      return json(res, 200, queryLogs(context, level, limit))
    }

    // POST — insert a log entry
    if (method === 'POST') {
      readBody(req, function (raw) {
        if (!raw) return json(res, 400, { error: 'Empty body' })
        var body
        try { body = JSON.parse(raw) } catch (_) {
          return json(res, 400, { error: 'Invalid JSON' })
        }
        var level   = (body.level   || 'message').toLowerCase()
        var context = (body.context || 'unknown').trim()
        var message = (body.message || '').trim()
        if (!message) return json(res, 400, { error: 'message is required' })

        var validLevels = ['debug', 'message', 'warning', 'critical']
        if (!validLevels.includes(level)) level = 'message'

        var lg = getLogger()
        if (lg) {
          var logOpts = body.instance_id ? { instanceId: body.instance_id } : undefined
          lg.log(level, context, message, body.detail !== undefined ? body.detail : undefined, logOpts)
          return json(res, 201, { ok: true })
        } else {
          return json(res, 503, { error: 'Logger unavailable (SQLite not loaded)' })
        }
      })
      return
    }

    return json(res, 405, { error: 'Method not allowed' })
  }

  // ── /src/v{BUILD_VER}/... — versioned ES module source files ────────────────
  // Every server restart produces a new BUILD_VER.  The HTML entry point injects
  // this version into the <script src="..."> URL so all modules in the graph are
  // served under a unique path, bypassing proxy and browser module-map caching.
  var SRC_VER_PREFIX = '/src/v' + BUILD_VER + '/'
  if (urlPath.startsWith(SRC_VER_PREFIX)) {
    var rel   = urlPath.slice(SRC_VER_PREFIX.length)
    var file3 = path.join(srcDir, rel)
    if (!file3.startsWith(srcDir)) { res.writeHead(403); res.end('Forbidden'); return }
    serveFile(res, file3)
    return
  }

  // ── /src/... — legacy unversioned route (still works for direct access) ───
  if (urlPath.startsWith('/src/')) {
    var relLeg   = urlPath.slice('/src/'.length)
    var file3Leg = path.join(srcDir, relLeg)
    if (!file3Leg.startsWith(srcDir)) { res.writeHead(403); res.end('Forbidden'); return }
    serveFile(res, file3Leg)
    return
  }

  // ── / or /index.html → dist/index.html (with versioned script src) ────────
  // The shell.js script tag is rewritten to point at the versioned path so that
  // all relative imports resolve under the same /src/v{ver}/ prefix, giving
  // every module a fresh URL on each server restart.
  if (urlPath === '/' || urlPath === '/index.html') {
    var htmlPath = path.join(distDir, 'index.html')
    try {
      var htmlSrc = fs.readFileSync(htmlPath, 'utf8')
      var htmlOut = htmlSrc.replace(
        /src="[^"]*shell\.js"/,
        'src="/src/v' + BUILD_VER + '/shell.js"'
      )
      res.writeHead(200, {
        'Content-Type':  'text/html; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma':        'no-cache',
        'Access-Control-Allow-Origin': '*',
      })
      res.end(htmlOut)
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'text/plain' })
      res.end('Failed to serve index.html: ' + e.message)
    }
    return
  }

  // ── Everything else → dist/ ───────────────────────────────────────────────
  var rel4  = urlPath.replace(/^\/+/, '') || 'index.html'
  var file4 = path.join(distDir, rel4)
  if (!file4.startsWith(distDir)) { res.writeHead(403); res.end('Forbidden'); return }
  serveFile(res, file4)
})

// ── Startup ───────────────────────────────────────────────────────────────────
;(async function main () {
  var lg = getLogger()
  if (lg) lg.setInstanceId(INSTANCE_ID)

  await buildControlRegistry()
  var count = Object.keys(control_registry).length
  server.listen(PORT, '0.0.0.0', function () {
    console.log()
    console.log('JSON-Control demo server running (ES modules, no bundler)')
    console.log('Control registry: ' + count + ' controls loaded')
    console.log('Build version:    ' + BUILD_VER + '  (JS served at /src/v' + BUILD_VER + '/)')
    console.log()
    console.log('  Index:  http://localhost:' + PORT + '/')
    console.log()
    console.log('  API:')
    console.log('    GET  /api/control_registry')
    console.log('    GET  /api/source/           list top-level src/ files')
    console.log('    GET  /api/source/:file      source of src/<file>.js')
    console.log('    GET  /api/source/controls/  list all control files')
    console.log('    GET  /api/source/controls/:file')
    console.log('    GET  /api/logs[?control=&level=&limit=]')
    console.log('    POST /api/logs  { level, context, message, detail? }')
    console.log()
    console.log('Press Ctrl-C to stop.')
  })
})()
