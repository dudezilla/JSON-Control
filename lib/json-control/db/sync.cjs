#!/usr/bin/env node
'use strict'

/**
 * sync.js — push unsynced local SQLite test results AND logs to Supabase.
 *
 * Usage:
 *   pnpm --filter @workspace/json-control db:sync
 *
 * Required environment variables:
 *   SUPABASE_URL              — e.g. https://xxxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY — service-role key (not the anon key)
 *
 * Optional:
 *   JCLOG_LEVEL=debug         Show detailed timing for every upsert
 *
 * The Supabase schema must already exist — run db/supabase-schema.sql once
 * in the Supabase SQL Editor before the first sync.
 */

const { createClient } = require('@supabase/supabase-js')
const log = require('./logger.cjs')
const {
  getUnsyncedRuns,
  getResultsForRun,
  markRunSynced,
  DB_PATH,
} = require('./db.cjs')
const { getUnsyncedLogs, markLogsSynced } = require('./logger.cjs')

const CTX          = 'sync'
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BATCH        = 200

// ── Preflight ─────────────────────────────────────────────────────────────────

if (!SUPABASE_URL || !SUPABASE_KEY) {
  log.critical(CTX, 'missing env vars — cannot sync', {
    SUPABASE_URL:              !!SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: !!SUPABASE_KEY,
  })
  console.error(
    '\nsync.js: missing env vars.\n' +
    '  SUPABASE_URL              — your project URL\n' +
    '  SUPABASE_SERVICE_ROLE_KEY — service-role key (Settings → API)\n'
  )
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
})

// ── Sync one test run ─────────────────────────────────────────────────────────

const syncRun = log.timed(async function syncRun (run) {
  // 1. Upsert the run row
  const { error: runErr } = await supabase
    .from('test_runs')
    .upsert({
      id:          run.id,
      ran_at:      run.ran_at,
      commit_hash: run.commit_hash,
      branch:      run.branch || null,
    }, { onConflict: 'id' })

  if (runErr) {
    log.critical(CTX, 'test_runs upsert failed', { runId: run.id, error: runErr.message })
    throw new Error('run upsert failed: ' + runErr.message)
  }

  // 2. Upsert results in batches
  const results = getResultsForRun(run.id)
  log.debug(CTX, 'syncRun: upserting results', { runId: run.id, count: results.length })

  for (let i = 0; i < results.length; i += BATCH) {
    const batch = results.slice(i, i + BATCH).map(function (r) {
      return {
        id:            r.id,
        run_id:        r.run_id,
        control_name:  r.control_name,
        test_name:     r.test_name,
        passed:        r.passed === 1,
        duration_ms:   r.duration_ms,
        error_message: r.error_message || null,
        source_file:   r.source_file,
        source_blob:   r.source_blob,
        test_file:     r.test_file,
        test_blob:     r.test_blob,
      }
    })

    const { error: resErr } = await supabase
      .from('test_results')
      .upsert(batch, { onConflict: 'id' })

    if (resErr) {
      log.critical(CTX, 'test_results upsert failed', {
        runId: run.id,
        batch: i,
        error: resErr.message,
      })
      throw new Error('results upsert failed (batch ' + i + '): ' + resErr.message)
    }
  }

  // 3. Mark locally as synced
  markRunSynced(run.id)
  log.message(CTX, 'syncRun complete', { runId: run.id, results: results.length })
  return results.length
}, CTX)

// ── Sync logs ─────────────────────────────────────────────────────────────────

async function syncLogs () {
  const rows = getUnsyncedLogs()
  if (rows.length === 0) {
    log.debug(CTX, 'syncLogs: nothing to sync')
    return 0
  }

  log.debug(CTX, 'syncLogs: upserting', { count: rows.length })

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH).map(function (r) {
      var detail = null
      if (r.detail) {
        try { detail = JSON.parse(r.detail) } catch (_) { detail = r.detail }
      }
      return {
        id:          r.id,
        logged_at:   r.logged_at,
        level:       r.level,
        context:     r.context,
        message:     r.message,
        detail,
        instance_id: r.instance_id || null,
      }
    })

    const { error } = await supabase
      .from('logs')
      .upsert(batch, { onConflict: 'id' })

    if (error) {
      log.critical(CTX, 'logs upsert failed', { batch: i, error: error.message })
      throw new Error('logs upsert failed (batch ' + i + '): ' + error.message)
    }
  }

  markLogsSynced(rows.map(function (r) { return r.id }))
  log.message(CTX, 'syncLogs complete', { pushed: rows.length })
  return rows.length
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main () {
  log.message(CTX, 'sync started', { db: DB_PATH, target: SUPABASE_URL })

  const runs = getUnsyncedRuns()

  if (runs.length === 0) {
    log.message(CTX, 'no unsynced runs')
  } else {
    let totalResults = 0

    for (const run of runs) {
      process.stdout.write(
        '  run ' + run.id.slice(0, 8) + '\u2026 (' +
        run.ran_at + ', ' + run.commit_hash.slice(0, 7) + ') '
      )
      try {
        const n = await syncRun(run)
        totalResults += n
        console.log('\u2713  ' + n + ' result(s)')
      } catch (err) {
        console.log('\u2717  ' + err.message)
      }
    }

    log.message(CTX, 'test results sync complete', {
      runs:    runs.length,
      results: totalResults,
    })
  }

  // Sync logs after test results (so log rows from this sync are also captured)
  try {
    const logCount = await syncLogs()
    if (logCount > 0) console.log('  Logs pushed: ' + logCount)
  } catch (err) {
    log.warning(CTX, 'log sync failed (non-fatal)', { error: err.message })
  }

  console.log('\nDone.')
}

main().catch(function (err) {
  log.critical(CTX, 'sync fatal error', { error: err.message, stack: err.stack })
  console.error('Fatal:', err.message)
  process.exit(1)
})
