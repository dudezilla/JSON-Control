'use strict'
/**
 * demo-pages.test.cjs
 *
 * Tests rendering of the demo pages using native ES module imports.
 * No bundler, no JSDOM script execution — modules are imported directly into
 * Node.js and called against a JSDOM-backed global document.
 *
 * How it works:
 *   1. beforeAll sets globalThis.window / .document to a JSDOM window so that
 *      all the ESM source modules can call document.createElement() etc.
 *   2. The control_registry is built from each control class's static .meta
 *      property — mirroring what build_registry.js does in the browser.
 *   3. Each test creates a fresh JSDOM, updates the global DOM vars, and calls
 *      the appropriate rendering function, then asserts on the resulting DOM.
 *
 * Control types (keyed by control_type string, not class name):
 *   boolean, verbose_boolean, radio, selection, observed_selection,
 *   value_display, code_snippet, collapsible_code, log_viewer, test_harness
 */

const { JSDOM } = require('jsdom')

// ── Per-test logging to SQLite ────────────────────────────────────────────────
const { randomUUID } = require('crypto')
const logger = process.env.JCTEST_DB !== '0'
  ? require('../../db/logger.cjs')
  : null

function testContext () {
  const name = (expect.getState().currentTestName || '').split(':')[0].trim()
  return name || 'demo-pages'
}

beforeEach(() => {
  // Reset the singleton so controls from one test don't bleed into the next.
  if (ControlRegistry_global) ControlRegistry_global.reset()
  if (!logger) return
  logger.debug(testContext(), 'Test started', { test: expect.getState().currentTestName || '' })
})

afterEach(() => {
  if (!logger) return
  logger.message(testContext(), 'Test complete', { test: expect.getState().currentTestName || '' })
})

// ── Module import + control_registry build ────────────────────────────────────
// page.js uses document/window as globals — must be set before importing.
// ESM modules are cached; subsequent imports reuse the same module instance,
// but all rendering functions look up `document` at call time so swapping the
// global between tests is safe.

let renderControl, renderDirectory, control_registry

let ControlRegistry_global

beforeAll(async () => {
  if (logger) logger.setInstanceId(randomUUID())

  // Bootstrap a JSDOM so module-level code has a valid window/document.
  const boot = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>')
  globalThis.window   = boot.window
  globalThis.document = boot.window.document

  // Import ControlRegistry so beforeEach can reset the singleton between tests.
  const collMod = await import('../../src/ControlCollection.js')
  ControlRegistry_global = collMod.ControlRegistry

  // Import page rendering functions.
  const mod = await import('../../src/page.js')
  renderControl   = mod.renderControl
  renderDirectory = mod.renderDirectory

  // Import all control classes and build the control_registry from their .meta
  // properties — mirrors what build_registry.js does in the browser at runtime.
  const controlMod = await import('../../src/controls/index.js')
  control_registry = {}
  for (const [, C] of Object.entries(controlMod)) {
    if (typeof C === 'function' && C.meta && C.meta.controlType) {
      control_registry[C.meta.controlType] = {
        controlType:   C.meta.controlType,
        category:      C.meta.category   || 'other',
        description:   C.meta.description || '',
        defaultConfig: C.meta.defaultConfig || null,
        tests:         C.meta.tests        || [],
        srcCode:       '/* source not loaded in test environment */',
      }
    }
  }
}, 30000)

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Create a fresh JSDOM window with a #root div and update globals. */
function freshDom () {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>')
  globalThis.window   = dom.window
  globalThis.document = dom.window.document
  return dom
}

function getSectionLabels (doc) {
  return Array.from(doc.querySelectorAll('.section-label')).map(el => el.textContent.trim())
}

/** Assert the standard sections are present for a control with a defaultConfig. */
function expectSectionLabels (doc) {
  const labels = getSectionLabels(doc)
  expect(labels).toContain('Control')
  expect(labels).toContain('Usage')
  expect(labels).toContain('Source')
  expect(labels).toContain('Config')
  expect(labels).toContain('Current value')
}

/**
 * Render a control page in a fresh JSDOM context and return the document +
 * any top-level errors thrown.
 *
 * @param {string} controlType  The control_type string (e.g. 'boolean')
 */
function renderControlSafe (controlType) {
  const dom    = freshDom()
  const errors = []
  try {
    renderControl(control_registry, controlType)
  } catch (e) {
    errors.push(e.message || String(e))
  }
  return { document: dom.window.document, errors }
}

// ── Per-control page-level tests ─────────────────────────────────────────────
// Each test checks that:
//   1. renderControl throws no top-level errors
//   2. The page sections (Control, Usage, Source, Config, Current value) are present
//
// DOM-element assertions (checkbox visible, radio inputs, pre>code, etc.) now
// live in each control's .meta.tests array and are exercised at runtime by
// TestHarnessControl, which renders a PASS/FAIL table on the control's detail
// page and logs every result via ControlLogger → /api/logs → SQLite.

test('BooleanControl: page renders without errors, all sections present', () => {
  const { document, errors } = renderControlSafe('boolean')
  expect(errors).toHaveLength(0)
  expectSectionLabels(document)
})

test('VerboseBooleanControl: page renders without errors, all sections present', () => {
  const { document, errors } = renderControlSafe('verbose_boolean')
  expect(errors).toHaveLength(0)
  expectSectionLabels(document)
})

test('RadioControl: page renders without errors, all sections present', () => {
  const { document, errors } = renderControlSafe('radio')
  expect(errors).toHaveLength(0)
  expectSectionLabels(document)
})

test('SelectionControl: page renders without errors, all sections present', () => {
  const { document, errors } = renderControlSafe('selection')
  expect(errors).toHaveLength(0)
  expectSectionLabels(document)
})

test('ObservedSelectionControl: page renders without errors, all sections present', () => {
  const { document, errors } = renderControlSafe('observed_selection')
  expect(errors).toHaveLength(0)
  expectSectionLabels(document)
})

test('ValueDisplayControl: page renders without errors, all sections present', () => {
  const { document, errors } = renderControlSafe('value_display')
  expect(errors).toHaveLength(0)
  expectSectionLabels(document)
})

test('CodeSnippetControl: page renders without errors, all sections present', () => {
  const { document, errors } = renderControlSafe('code_snippet')
  expect(errors).toHaveLength(0)
  expectSectionLabels(document)
})

test('CollapsibleCodeControl: page renders without errors, all sections present', () => {
  const { document, errors } = renderControlSafe('collapsible_code')
  expect(errors).toHaveLength(0)
  expectSectionLabels(document)
})

test('PageControl: page renders without errors, all sections present, children present', () => {
  const { document, errors } = renderControlSafe('page')
  expect(errors).toHaveLength(0)
  expectSectionLabels(document)
  // Root wrapper must carry the pc-page class
  const pcPage = document.querySelector('.pc-page')
  expect(pcPage).not.toBeNull()
  // Title heading must be present
  expect(document.querySelector('h1.pc-title')).not.toBeNull()
  // Children (two booleans) are rendered inside the page
  const checkboxes = document.querySelectorAll('input[type=checkbox]')
  expect(checkboxes.length).toBeGreaterThanOrEqual(2)
})

test('TextInputControl: page renders without errors, input present with correct placeholder', () => {
  const { document, errors } = renderControlSafe('text_input')
  expect(errors).toHaveLength(0)
  expectSectionLabels(document)
  expect(document.querySelector('.ctrl-text-input')).not.toBeNull()
  const inp = document.querySelector('input[type=text]')
  expect(inp).not.toBeNull()
  expect(inp.placeholder).toBe('Type something...')
})

test('ListBuilderControl: page renders without errors, table structure and add button present', () => {
  const { document, errors } = renderControlSafe('list_builder')
  expect(errors).toHaveLength(0)
  expectSectionLabels(document)
  expect(document.querySelector('.ctrl-list-builder')).not.toBeNull()
  expect(document.querySelector('.lb-add-btn')).not.toBeNull()
  expect(document.querySelector('.lb-rows')).not.toBeNull()
  // Column headers: 4 fields + 1 remove = 5
  const headers = document.querySelectorAll('.lb-col-header')
  expect(headers.length).toBe(5)
})

test('TrackControl: page renders without errors, nav and viewport present, active page shown', () => {
  const { document, errors } = renderControlSafe('track')
  expect(errors).toHaveLength(0)
  expectSectionLabels(document)
  // Root wrapper
  expect(document.querySelector('.tk-track')).not.toBeNull()
  // Top nav with progress dots
  expect(document.querySelector('.tk-nav-top')).not.toBeNull()
  const dots = document.querySelectorAll('.tk-dot')
  expect(dots.length).toBe(2)
  // Bottom nav buttons
  expect(document.querySelector('.tk-btn-prev')).not.toBeNull()
  expect(document.querySelector('.tk-btn-next')).not.toBeNull()
  // Viewport — single swap div holds exactly one page element
  const vp = document.querySelector('.tk-viewport')
  expect(vp).not.toBeNull()
  expect(vp.children.length).toBe(1)
  // Child checkbox (boolean) rendered inside the active page
  const checkboxes = document.querySelectorAll('input[type=checkbox]')
  expect(checkboxes.length).toBeGreaterThanOrEqual(1)
})

test('CompositeControl: page renders without errors, all sections present, children present', () => {
  const { document, errors } = renderControlSafe('composite')
  expect(errors).toHaveLength(0)
  expectSectionLabels(document)
  // The composite wrapper must be present and contain at least two child inputs
  const checkboxes = document.querySelectorAll('input[type=checkbox]')
  expect(checkboxes.length).toBeGreaterThanOrEqual(2)
})

test('LogViewerControl: page renders without errors, all sections present, filter buttons visible', () => {
  const { document, errors } = renderControlSafe('log_viewer')
  expect(errors).toHaveLength(0)
  expectSectionLabels(document)
  // Level filter buttons must all be present
  const btns = Array.from(document.querySelectorAll('button[data-level]'))
    .map(b => b.dataset.level)
  ;['ALL', 'DEBUG', 'MESSAGE', 'WARNING', 'CRITICAL'].forEach(lvl => {
    expect(btns).toContain(lvl)
  })
})

// ── ControlRegistry iterator tests ───────────────────────────────────────────

describe('ControlRegistry — native iterator protocol', () => {
  let ControlRegistry_cls, ControlConfiguration_cls, BooleanControl_cls

  beforeAll(async () => {
    const collMod  = await import('../../src/ControlCollection.js')
    const ctrlMod  = await import('../../src/controls/BooleanControl.js')
    ControlRegistry_cls     = collMod.ControlRegistry
    ControlConfiguration_cls = collMod.ControlConfiguration
    BooleanControl_cls       = ctrlMod.BooleanControl
  })

  /** Build a minimal BooleanControl wired to a fresh JSDOM root. */
  function makeBoolean (rootId, name, state = false) {
    const dom = new JSDOM(`<!DOCTYPE html><html><body><div id="${rootId}"></div></body></html>`)
    globalThis.window   = dom.window
    globalThis.document = dom.window.document
    const cfg = new ControlConfiguration_cls({ name, label: name, state, control_type: 'boolean' })
    cfg.setRootID(rootId)
    return new BooleanControl_cls(cfg)
  }

  test('[Symbol.iterator] — for...of yields all controls', () => {
    const bindings = new ControlRegistry_cls()
    const a = makeBoolean('root_a', 'alpha')
    const b = makeBoolean('root_b', 'beta')
    bindings.append(a)
    bindings.append(b)

    const collected = []
    for (const ctrl of bindings) {
      collected.push(ctrl.getName())
    }
    expect(collected).toEqual(['alpha', 'beta'])
  })

  test('entries() — yields [id, control] pairs', () => {
    const bindings = new ControlRegistry_cls()
    const c = makeBoolean('root_c', 'gamma')
    bindings.append(c)

    const pairs = Array.from(bindings.entries())
    expect(pairs).toHaveLength(1)
    const [id, ctrl] = pairs[0]
    expect(typeof id).toBe('string')
    expect(ctrl.getName()).toBe('gamma')
  })

  test('size getter — returns correct count', () => {
    const bindings = new ControlRegistry_cls()
    expect(bindings.size).toBe(0)
    bindings.append(makeBoolean('root_d', 'delta'))
    expect(bindings.size).toBe(1)
    bindings.append(makeBoolean('root_e', 'epsilon'))
    expect(bindings.size).toBe(2)
  })

  test('toValueMap() — returns Map of name → current value', () => {
    const bindings = new ControlRegistry_cls()
    bindings.append(makeBoolean('root_f', 'flag_a', false))
    bindings.append(makeBoolean('root_g', 'flag_b', true))

    const map = bindings.toValueMap()
    expect(map).toBeInstanceOf(Map)
    expect(map.get('flag_a')).toBe(false)
    expect(map.get('flag_b')).toBe(true)
  })

  test('spread — [...bindings] collects all controls', () => {
    const bindings = new ControlRegistry_cls()
    bindings.append(makeBoolean('root_h', 'zeta'))
    bindings.append(makeBoolean('root_i', 'eta'))

    const arr = [...bindings]
    expect(arr).toHaveLength(2)
    expect(arr.map(c => c.getName())).toEqual(['zeta', 'eta'])
  })
})

// ── ConfigDownloadControl ─────────────────────────────────────────────────────

test('ConfigDownloadControl: page renders without errors, button and hint present', () => {
  const { document, errors } = renderControlSafe('config_download')
  expect(errors).toHaveLength(0)
  expectSectionLabels(document)
  expect(document.querySelector('.ctrl-config-download')).not.toBeNull()
  // Styled download button
  const btn = document.querySelector('button.cd-btn')
  expect(btn).not.toBeNull()
  // Filename hint
  const hint = document.querySelector('.cd-hint')
  expect(hint).not.toBeNull()
  expect(hint.textContent).toBe('config.json')
  // Icon inside button
  expect(document.querySelector('.cd-icon')).not.toBeNull()
})

// ── ConfigUploadControl ───────────────────────────────────────────────────────

test('ConfigUploadControl: page renders without errors, file input, pick button and status present', () => {
  const { document, errors } = renderControlSafe('config_upload')
  expect(errors).toHaveLength(0)
  expectSectionLabels(document)
  expect(document.querySelector('.ctrl-config-upload')).not.toBeNull()
  // Hidden file input
  const inp = document.querySelector('input.cu-file-input')
  expect(inp).not.toBeNull()
  expect(inp.type).toBe('file')
  expect(inp.accept).toBe('.json')
  // Styled pick button (a label)
  expect(document.querySelector('label.cu-pick-btn')).not.toBeNull()
  // Status indicator
  const status = document.querySelector('.cu-status')
  expect(status).not.toBeNull()
  expect(status.textContent).toBe('No file loaded')
})

// ── Directory view ────────────────────────────────────────────────────────────

test('directory view: no errors, category headings and control links rendered', () => {
  const dom    = freshDom()
  const errors = []
  try {
    renderDirectory(control_registry)
  } catch (e) {
    errors.push(e.message || String(e))
  }
  expect(errors).toHaveLength(0)

  // Expect at least 5 category headings (input, selection, composite, display, debug)
  const headings = dom.window.document.querySelectorAll('h2.index-section')
  expect(headings.length).toBeGreaterThanOrEqual(5)

  // Expect a link for every non-harness control (8+) via ?view=control&type=
  const links = Array.from(dom.window.document.querySelectorAll('a[href]'))
    .filter(a => a.getAttribute('href').includes('view=control'))
  expect(links.length).toBeGreaterThanOrEqual(8)
})
