'use strict'

const { execSync } = require('child_process')
const path = require('path')

const ROOT = path.resolve(__dirname, '../../..')

function run (cmd) {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
  } catch {
    return null
  }
}

/** Full 40-char commit hash of HEAD, or 'unknown'. */
function commitHash () {
  return run('git rev-parse HEAD') || 'unknown'
}

/** Current branch name, or 'unknown'. */
function branch () {
  return run('git rev-parse --abbrev-ref HEAD') || 'unknown'
}

/**
 * Git blob hash for a file at HEAD.
 * Use later with: git cat-file blob <hash>
 *
 * @param {string} relPath - path relative to repo root
 * @returns {string} 40-char blob hash, or 'unknown'
 */
function blobHash (relPath) {
  const out = run(`git ls-tree HEAD -- "${relPath}"`)
  if (!out) return 'unknown'
  // format: "100644 blob <hash>  <path>"
  const parts = out.split(/\s+/)
  return parts[2] || 'unknown'
}

module.exports = { commitHash, branch, blobHash }
