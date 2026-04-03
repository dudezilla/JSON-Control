'use strict'

/**
 * Jest custom reporter — records test durations and git provenance to SQLite.
 *
 * Enabled via jest.config.cjs:
 *   reporters: ['default', '<rootDir>/db/reporter.js']
 *
 * Set JCTEST_DB=0 to disable without removing from config (e.g. in CI).
 * Set JCLOG_LEVEL=debug to see per-test timing and input serialisation.
 */

const path = require('path')
const log = require('./logger.cjs')
const { commitHash, branch, blobHash } = require('./git.cjs')
const { insertRun, insertResult } = require('./db.cjs')

const CTX      = 'reporter'
const ROOT     = path.resolve(__dirname, '../../..')
const DISABLED = process.env.JCTEST_DB === '0'

// ── Helpers ───────────────────────────────────────────────────────────────────

// Infer control name from the full Jest test title.
// "RangeControl: slider renders..." → "RangeControl"
// "index.html directory view: ..."  → "index"
function inferControlName (fullName) {
  const m = fullName.match(/^([A-Z][A-Za-z]+Control)/)
  if (m) return m[1]
  const colon = fullName.indexOf(':')
  return colon > 0 ? fullName.slice(0, colon).trim() : fullName.trim()
}

// Map a control name to its source file relative to repo root.
function sourceFileFor (controlName) {
  return `lib/json-control/src/${controlName}.js`
}

// ── Reporter class ────────────────────────────────────────────────────────────

class MetaReporter {
  constructor (_globalConfig, _options) {
    this._runId     = null
    this._blobCache = {}
    this._runStart  = null
  }

  _blob (relPath) {
    if (!this._blobCache[relPath]) {
      try {
        this._blobCache[relPath] = blobHash(relPath)
      } catch (err) {
        log.warning(CTX, 'blobHash failed', { relPath, error: err.message })
        this._blobCache[relPath] = 'unknown'
      }
    }
    return this._blobCache[relPath]
  }

  onRunStart () {
    if (DISABLED) return
    this._runStart = Date.now()

    let hash = 'unknown'
    let br   = 'unknown'
    try { hash = commitHash() } catch (err) { log.warning(CTX, 'commitHash failed', { error: err.message }) }
    try { br   = branch()     } catch (err) { log.warning(CTX, 'branch failed',     { error: err.message }) }

    try {
      this._runId = insertRun({ commitHash: hash, branch: br })
      log.message(CTX, 'run started', { runId: this._runId, commitHash: hash, branch: br })
    } catch (err) {
      log.critical(CTX, 'onRunStart: could not create run row', {
        error: err.message,
        commitHash: hash,
        branch: br,
      })
    }
  }

  onTestResult (testFileInfo, suiteResult) {
    if (DISABLED || !this._runId) return

    const absTestFile = testFileInfo.testFilePath || ''
    const testFile    = absTestFile
      ? path.relative(ROOT, absTestFile).replace(/\\/g, '/')
      : 'unknown'
    const testBlob    = this._blob(testFile)

    let passed = 0
    let failed = 0

    for (const t of suiteResult.testResults) {
      const controlName = inferControlName(t.fullName || t.title || '')
      const srcFile     = sourceFileFor(controlName)
      const srcBlob     = this._blob(srcFile)
      const isPassed    = t.status === 'passed'
      const err         = t.failureMessages && t.failureMessages.length
        ? t.failureMessages[0].split('\n').slice(0, 5).join(' ')
        : null

      log.debug(CTX, 'onTestResult', {
        test:       t.fullName || t.title,
        control:    controlName,
        status:     t.status,
        durationMs: t.duration,
        error:      err,
      })

      try {
        insertResult({
          runId:        this._runId,
          controlName,
          testName:     t.fullName || t.title || '',
          passed:       isPassed,
          durationMs:   typeof t.duration === 'number' ? t.duration : 0,
          errorMessage: err,
          sourceFile:   srcFile,
          sourceBlob:   srcBlob,
          testFile,
          testBlob,
        })
        isPassed ? passed++ : failed++
      } catch (insertErr) {
        log.critical(CTX, 'insertResult failed', {
          test:  t.fullName || t.title,
          error: insertErr.message,
        })
      }
    }

    log.message(CTX, 'suite complete', {
      file:   testFile,
      passed,
      failed,
      total:  passed + failed,
    })
  }

  onRunComplete (_contexts, results) {
    if (DISABLED || !this._runId) return
    const elapsed = this._runStart ? Date.now() - this._runStart : null

    if (results.numFailedTests > 0) {
      log.warning(CTX, 'run complete — failures present', {
        runId:    this._runId,
        passed:   results.numPassedTests,
        failed:   results.numFailedTests,
        elapsedMs: elapsed,
      })
    } else {
      log.message(CTX, 'run complete — all passed', {
        runId:    this._runId,
        total:    results.numPassedTests,
        elapsedMs: elapsed,
      })
    }
  }
}

module.exports = MetaReporter
