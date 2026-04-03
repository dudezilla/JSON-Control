#!/usr/bin/env node
/**
 * serve-watch.js — auto-reload wrapper for serve.js.
 *
 * Starts serve.js as a child process, then polls the remote repository
 * every POLL_MS milliseconds. When the remote HEAD has advanced past the
 * local HEAD it does a `git pull --ff-only` and restarts the server.
 *
 * Usage:
 *   node serve-watch.js           # poll every 15 s (default)
 *   POLL=30 node serve-watch.js   # poll every 30 s
 */

import { spawn, execFileSync } from 'child_process'
import path                    from 'path'
import { fileURLToPath }       from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Repo root is three levels up from lib/json-control/
const ROOT    = path.resolve(__dirname, '..', '..')
const POLL_MS = (parseInt(process.env.POLL || '15', 10) || 15) * 1000

// ── Git helpers ───────────────────────────────────────────────────────────────

function git (...args) {
  try {
    return execFileSync('git', args, {
      cwd:      ROOT,
      encoding: 'utf8',
      stdio:    ['pipe', 'pipe', 'pipe'],
    }).trim()
  } catch (_) {
    return null
  }
}

/** Local HEAD commit hash. */
function localHead () {
  return git('rev-parse', 'HEAD')
}

/**
 * Remote HEAD commit hash via `git ls-remote`.
 * Lightweight — does not download objects, just queries the ref.
 */
function remoteHead () {
  var out = git('ls-remote', 'origin', 'HEAD')
  if (!out) return null
  // output: "<hash>\tHEAD"
  return out.split(/\s+/)[0] || null
}

// ── Server process ────────────────────────────────────────────────────────────

var child = null

function startServer () {
  if (child) {
    try { child.kill('SIGTERM') } catch (_) {}
    child = null
  }

  child = spawn(process.execPath, [path.join(__dirname, 'serve.js')], {
    stdio: 'inherit',
    env:   process.env,
    cwd:   __dirname,
  })

  child.on('exit', function (code, signal) {
    if (signal === 'SIGTERM') return   // we killed it ourselves — ignore
    console.warn('[watch] serve.js exited (code=' + code + ') — restarting in 2 s…')
    setTimeout(startServer, 2000)
  })
}

// ── Poll loop ─────────────────────────────────────────────────────────────────

function poll () {
  var local  = localHead()
  var remote = remoteHead()

  if (!remote || !local) {
    console.warn('[watch] Could not determine remote HEAD — skipping this cycle')
    return
  }

  if (local === remote) return   // already up to date

  console.log(
    '[watch] Remote advanced to ' + remote.slice(0, 7) +
    ' (local: ' + local.slice(0, 7) + ') — pulling…'
  )

  var result = git('pull', '--ff-only')
  if (result === null) {
    console.warn('[watch] git pull failed — will retry next cycle')
    return
  }

  console.log('[watch] Pulled OK. Restarting server…')
  startServer()
}

// ── Startup ───────────────────────────────────────────────────────────────────

var pollSec = POLL_MS / 1000
console.log('[watch] Polling remote every ' + pollSec + ' s (POLL=' + pollSec + ' to override)')
startServer()
setInterval(poll, POLL_MS)
