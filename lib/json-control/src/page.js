/**
 * page.js — rendering functions for the demo site.
 *
 * Imported by shell.js (browser entry point) and directly by the test suite.
 * All functions read/write the DOM through the global `document` and `window`,
 * which are set by the browser or (in tests) by the JSDOM setup in beforeAll.
 *
 * The control_registry passed in from shell.js is built client-side by build_registry.js.
 * Each entry is keyed by control_type and contains:
 *   { controlType, category, description, defaultConfig, tests, srcCode }
 *
 * Log REST API helpers (exported for external use)
 * ─────────────────────────────────────────────────────────────────────────────
 *   fetchLogs({ control, level, limit })           → Promise<Array>
 *   postLog({ level, context, message, detail })   → Promise<{ ok: true }>
 */
import { ControlFactory, ControlConfiguration, CodeSnippetControl, ValueDisplayControl, LogViewerControl, TestHarnessControl } from './index.js'

var API_BASE = '/api'

// ── REST helpers ──────────────────────────────────────────────────────────────

/**
 * GET /api/logs — fetch log entries, optionally filtered by control.
 * @param {{ control?: string, level?: string, limit?: number }} opts
 * @returns {Promise<Array>}
 */
export function fetchLogs (opts) {
  if (typeof fetch === 'undefined') return Promise.resolve([])
  var p = new URLSearchParams()
  if (opts && opts.control) p.set('control', opts.control)
  if (opts && opts.level)   p.set('level',   opts.level)
  if (opts && opts.limit)   p.set('limit',   String(opts.limit))
  return fetch(API_BASE + '/logs?' + p.toString()).then(function (r) { return r.json() })
}

/**
 * POST /api/logs — write a new log entry.
 * @param {{ level?: string, context: string, message: string, detail?: * }} entry
 * @returns {Promise<{ ok: boolean }>}
 */
export function postLog (entry) {
  if (typeof fetch === 'undefined') return Promise.resolve({ ok: false })
  return fetch(API_BASE + '/logs', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(entry),
  }).then(function (r) { return r.json() })
}

// ── Internal DOM helpers ──────────────────────────────────────────────────────

function addSectionLabel (root, text) {
  var lbl = document.createElement('p')
  lbl.className = 'section-label'
  lbl.textContent = text
  root.appendChild(lbl)
}

/**
 * Append a CodeSnippetControl to root and return the control instance so its
 * value can be updated later.
 */
function addCodeSnippet (root, name, code, label) {
  var cfg = new ControlConfiguration({ name: name, label: label, state: code, control_type: 'code_snippet' })
  cfg.setRootID('root')
  var ctrl = new CodeSnippetControl(cfg)
  root.appendChild(ctrl.buildSubControls())
  return ctrl
}

// ── Control view ──────────────────────────────────────────────────────────────

/**
 * Render a single control page.
 * @param {Object} control_registry   — the full registry built by build_registry.js
 * @param {string} controlType        — the control_type key (e.g. "boolean")
 */
export function renderControl (control_registry, controlType) {
  var root  = document.getElementById('root')
  var entry = control_registry[controlType]

  if (!entry) {
    var err = document.createElement('p')
    err.className = 'error'
    err.textContent = 'Unknown control type: ' + controlType
    root.appendChild(err)
    return
  }

  var nav = document.createElement('nav')
  nav.innerHTML = '<a href="./">\u2190 index</a>'
  root.appendChild(nav)

  var h1 = document.createElement('h1')
  h1.textContent = entry.controlType
  root.appendChild(h1)

  var descEl = document.createElement('p')
  descEl.className = 'desc'
  descEl.textContent = entry.description || ''
  root.appendChild(descEl)

  // Live control — only if defaultConfig is available
  var ctrl = null
  if (entry.defaultConfig) {
    addSectionLabel(root, 'Control')
    var factory = new ControlFactory([entry.defaultConfig], 'root')
    factory.build()
    factory.mount(root)
    ctrl = factory.getControls()[0]

    // Usage — generated from defaultConfig
    addSectionLabel(root, 'Usage')
    var usageCode = [
      'var factory = new ControlFactory([',
      '  ' + JSON.stringify(entry.defaultConfig, null, 2).replace(/\n/g, '\n  '),
      '], "root")',
      'factory.build().mount(document.getElementById("root"))',
    ].join('\n')
    addCodeSnippet(root, 'usage_' + controlType, usageCode, 'Usage')

    // Config snapshot
    addSectionLabel(root, 'Config')
    addCodeSnippet(root, 'cfg_' + controlType, JSON.stringify(ctrl.getConfig(), null, 2), 'Config')

    // Live value display
    addSectionLabel(root, 'Current value')
    var initVal = ctrl.getValue()
    var valCfg = new ControlConfiguration({
      name: 'val_' + controlType,
      label: 'Value:',
      state: typeof initVal === 'object' ? JSON.stringify(initVal) : String(initVal),
      control_type: 'value_display',
    })
    valCfg.setRootID('root')
    var valCtrl = new ValueDisplayControl(valCfg)
    root.appendChild(valCtrl.buildSubControls())
    ;['click', 'input', 'change'].forEach(function (ev) {
      root.addEventListener(ev, function () {
        setTimeout(function () {
          var v = ctrl.getValue()
          valCtrl.setValue(typeof v === 'object' ? JSON.stringify(v) : String(v))
          valCtrl.updateView()
        }, 0)
      })
    })
  }

  // Source — fetched from /src/controls/<file> by build_registry.js at load time
  addSectionLabel(root, 'Source')
  addCodeSnippet(root, 'src_' + controlType, entry.srcCode || '/* source unavailable */', 'Source')

  // Tests — run the .meta.tests suite for this control type
  addSectionLabel(root, 'Tests')
  if (entry.tests && entry.tests.length > 0) {
    var harnessConfig = new ControlConfiguration({
      name:         'harness_' + controlType,
      label:        controlType + ' tests',
      state:      'pending',
      control_type: 'test_harness',
      config_class: controlType,
    })
    harnessConfig.setRootID('root')
    var harness = new TestHarnessControl(harnessConfig)
    root.appendChild(harness.buildSubControls())
  } else {
    var noTests = document.createElement('p')
    noTests.className = 'th-empty'
    noTests.textContent = 'No tests defined for this control.'
    root.appendChild(noTests)
  }

  // Log viewer — polls /api/logs filtered by control type
  addSectionLabel(root, 'Logs')
  var logCfg = new ControlConfiguration({
    name:         'log_viewer',
    label:        controlType,
    state:      '[]',
    control_type: 'log_viewer',
    height:       '240px',
    maxEntries:   200,
  })
  logCfg.setRootID('root')
  var logCtrl = new LogViewerControl(logCfg)
  root.appendChild(logCtrl.buildSubControls())
  function pollLogs () {
    fetchLogs({ control: controlType, limit: 200 })
      .then(function (rows) { logCtrl.setValue(rows); logCtrl.updateView() })
      .catch(function () {})
  }
  pollLogs()
  setInterval(pollLogs, 5000)
}

// ── Directory view ────────────────────────────────────────────────────────────

// Category display order and labels
var CATEGORY_ORDER = ['input', 'selection', 'composite', 'display', 'debug', 'other']
var CATEGORY_LABEL = {
  input:     'Input',
  selection: 'Selection',
  composite: 'Composite',
  display:   'Display',
  debug:     'Debug / Observability',
  other:     'Other',
}

/**
 * Render the control directory index, grouped by category.
 * @param {Object} control_registry — the full registry built by build_registry.js
 */
export function renderDirectory (control_registry) {
  var root = document.getElementById('root')

  // Group entries by category
  var groups = {}
  Object.values(control_registry).forEach(function (entry) {
    var cat = entry.category || 'other'
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(entry)
  })

  var html = '<h1>JSON-Control</h1>'
  html += '<p class="desc">Native ES module control library. Click a control to see it live.</p>'

  CATEGORY_ORDER.forEach(function (cat) {
    var entries = groups[cat]
    if (!entries || entries.length === 0) return
    html += '<h2 class="index-section">' + (CATEGORY_LABEL[cat] || cat) + '</h2>'
    html += '<ul class="control-list">'
    entries.forEach(function (entry) {
      html += '<li>'
      html += '<a href="?view=control&type=' + entry.controlType + '">' + entry.controlType + '</a>'
      html += ' \u2014 ' + entry.description
      html += '</li>'
    })
    html += '</ul>'
  })

  root.innerHTML = html
}
