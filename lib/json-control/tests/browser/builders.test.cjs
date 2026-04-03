'use strict'
/**
 * builders.test.cjs
 *
 * Tests for the two factory functions in src/builders.js:
 *   createPageBuilderTrack  — a TrackControl that produces PageControl configs
 *   createTrackBuilderTrack — a TrackControl that produces TrackControl configs
 *
 * Also tests the pure transform functions:
 *   buildPageConfig(snapshot)  → PageControl config
 *   buildTrackConfig(snapshot) → TrackControl config
 */

const { JSDOM } = require('jsdom')

let buildPageConfig, buildTrackConfig, parseDefault
let createPageBuilderTrack, createTrackBuilderTrack
let ControlRegistry_global

beforeAll(async () => {
  // Bootstrap a JSDOM so all ESM controls can call document.createElement()
  const boot = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>')
  globalThis.window   = boot.window
  globalThis.document = boot.window.document

  // Import ControlRegistry so beforeEach can reset the singleton between tests.
  const collMod = await import('../../src/ControlCollection.js')
  ControlRegistry_global = collMod.ControlRegistry

  // Import ESM builders (works because NODE_OPTIONS='--experimental-vm-modules')
  const mod = await import('../../src/builders.js')
  buildPageConfig        = mod.buildPageConfig
  buildTrackConfig       = mod.buildTrackConfig
  parseDefault           = mod.parseDefault
  createPageBuilderTrack = mod.createPageBuilderTrack
  createTrackBuilderTrack = mod.createTrackBuilderTrack
})

beforeEach(() => {
  // Reset the singleton so controls from one test don't bleed into the next.
  if (ControlRegistry_global) ControlRegistry_global.reset()
})

// ── Helper: fresh JSDOM per test ──────────────────────────────────────────────
function freshDOM () {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>')
  globalThis.window   = dom.window
  globalThis.document = dom.window.document
  return dom
}

// ── parseDefault ──────────────────────────────────────────────────────────────

describe('parseDefault', () => {
  test('empty string + boolean type → false', () => {
    expect(parseDefault('', 'boolean')).toBe(false)
  })
  test('empty string + text_input type → "Sample text"', () => {
    expect(parseDefault('', 'text_input')).toBe('Sample text')
  })
  test('empty string + unknown type → "N/A"', () => {
    expect(parseDefault('', 'selection')).toBe('N/A')
  })
  test('"true" string → boolean true', () => {
    expect(parseDefault('true', 'boolean')).toBe(true)
  })
  test('"false" string → boolean false', () => {
    expect(parseDefault('false', 'boolean')).toBe(false)
  })
  test('arbitrary string passes through', () => {
    expect(parseDefault('hello', 'text_input')).toBe('hello')
  })
})

// ── buildPageConfig ───────────────────────────────────────────────────────────

describe('buildPageConfig', () => {
  const sampleSnap = {
    identity: {
      name:        'test_page',
      label:       'Test Page',
      description: 'A test page.',
      layout:      'sidebar-left',
    },
    children: {
      fields: [
        { name: 'enabled', label: 'Enabled', type: 'boolean',    default: 'false', zone: 'sidebar' },
        { name: 'output',  label: 'Output',  type: 'log_viewer', default: '',      zone: 'main'    },
      ],
    },
    preview: { config_json: '' },
  }

  test('produces control_type: page', () => {
    expect(buildPageConfig(sampleSnap).control_type).toBe('page')
  })
  test('carries name from identity step', () => {
    expect(buildPageConfig(sampleSnap).name).toBe('test_page')
  })
  test('carries label from identity step', () => {
    expect(buildPageConfig(sampleSnap).label).toBe('Test Page')
  })
  test('carries layout from identity step', () => {
    expect(buildPageConfig(sampleSnap).layout).toBe('sidebar-left')
  })
  test('produces children array with correct length', () => {
    expect(buildPageConfig(sampleSnap).children).toHaveLength(2)
  })
  test('child 0 has correct name and control_type', () => {
    const c = buildPageConfig(sampleSnap).children[0]
    expect(c.name).toBe('enabled')
    expect(c.control_type).toBe('boolean')
  })
  test('child 0 default "false" coerces to boolean false', () => {
    expect(buildPageConfig(sampleSnap).children[0].state).toBe(false)
  })
  test('child 0 zone is "sidebar"', () => {
    expect(buildPageConfig(sampleSnap).children[0].zone).toBe('sidebar')
  })
  test('child 1 has empty default → N/A for log_viewer', () => {
    expect(buildPageConfig(sampleSnap).children[1].state).toBe('N/A')
  })
  test('rows with no name are filtered out', () => {
    const snap = { identity: { name: 'p', label: 'P', layout: 'full-width' },
                   children: { fields: [{ name: '', label: '', type: 'boolean', default: '', zone: '' }] } }
    expect(buildPageConfig(snap).children).toHaveLength(0)
  })
  test('empty snapshot uses sensible defaults', () => {
    const cfg = buildPageConfig({})
    expect(cfg.name).toBe('my_page')
    expect(cfg.layout).toBe('full-width')
    expect(cfg.children).toHaveLength(0)
  })
})

// ── buildTrackConfig ──────────────────────────────────────────────────────────

describe('buildTrackConfig', () => {
  const page1 = {
    control_type: 'page',
    name:    'step_a',
    label:   'Step A',
    layout:  'full-width',
    children: [
      { control_type: 'boolean', name: 'alpha', label: 'Alpha', state: true, zone: 'main' },
    ],
  }
  const page2 = {
    control_type: 'page',
    name:    'step_b',
    label:   'Step B',
    layout:  'two-pane',
    children: [
      { control_type: 'text_input', name: 'beta', label: 'Beta', state: 'hello', zone: 'left' },
    ],
  }
  const sampleSnap = {
    identity:  { name: 'test_track', label: 'Test Track', allow_jump: false },
    structure: { pages: [page1, page2] },
    preview:   { config_json: '' },
  }

  test('produces control_type: track', () => {
    expect(buildTrackConfig(sampleSnap).control_type).toBe('track')
  })
  test('carries name from identity step', () => {
    expect(buildTrackConfig(sampleSnap).name).toBe('test_track')
  })
  test('carries label from identity step', () => {
    expect(buildTrackConfig(sampleSnap).label).toBe('Test Track')
  })
  test('produces two pages', () => {
    expect(buildTrackConfig(sampleSnap).pages).toHaveLength(2)
  })
  test('pages are passed through verbatim', () => {
    const pages = buildTrackConfig(sampleSnap).pages
    expect(pages[0]).toBe(page1)
    expect(pages[1]).toBe(page2)
  })
  test('first page name is preserved', () => {
    expect(buildTrackConfig(sampleSnap).pages[0].name).toBe('step_a')
  })
  test('second page layout is preserved', () => {
    expect(buildTrackConfig(sampleSnap).pages[1].layout).toBe('two-pane')
  })
  test('allow_jump boolean true is preserved', () => {
    const snap = { identity: { name: 't', label: 'T', allow_jump: true },
                   structure: { pages: [] } }
    expect(buildTrackConfig(snap).allowJump).toBe(true)
  })
  test('allow_jump defaults to false', () => {
    expect(buildTrackConfig(sampleSnap).allowJump).toBe(false)
  })
  test('missing pages array defaults to empty array', () => {
    const snap = { identity: { name: 't', label: 'T' }, structure: {} }
    expect(buildTrackConfig(snap).pages).toHaveLength(0)
  })
  test('empty snapshot uses sensible defaults', () => {
    const cfg = buildTrackConfig({})
    expect(cfg.name).toBe('my_track')
    expect(cfg.label).toBe('My Track')
    expect(cfg.pages).toHaveLength(0)
    expect(cfg.allowJump).toBe(false)
  })
  test('state is always 0', () => {
    expect(buildTrackConfig(sampleSnap).state).toBe(0)
  })
})

// ── createPageBuilderTrack ────────────────────────────────────────────────────

describe('createPageBuilderTrack', () => {
  let track

  beforeEach(() => {
    freshDOM()
    track = createPageBuilderTrack()
  })

  test('returns an object with _pages', () => {
    expect(Array.isArray(track._pages)).toBe(true)
  })
  test('has exactly 3 steps', () => {
    expect(track._pages.length).toBe(3)
  })
  test('step 0 is named "identity"', () => {
    expect(track.getStep(0).getName()).toBe('identity')
  })
  test('step 1 is named "children"', () => {
    expect(track.getStep(1).getName()).toBe('children')
  })
  test('step 2 is named "preview"', () => {
    expect(track.getStep(2).getName()).toBe('preview')
  })
  test('identity step has 4 controls', () => {
    expect(track.getStep('identity')._controls.length).toBe(4)
  })
  test('children step has 1 control (list_builder)', () => {
    expect(track.getStep('children')._controls.length).toBe(1)
  })
  test('preview step has 1 control (collapsible_code)', () => {
    expect(track.getStep('preview')._controls.length).toBe(1)
  })
  test('DOM root has tk-track class', () => {
    expect(track.getElement().classList.contains('tk-track')).toBe(true)
  })
  test('navigating to step 2 updates preview code control', () => {
    track.goTo(0)
    track.goTo(2)  // fires onPageChange → preview update
    const previewCtrl = track.getStep('preview')._controls.find(c => c.getName() === 'config_json')
    const val = previewCtrl.getValue()
    // Should now contain a JSON object (not the placeholder comment)
    expect(val).toContain('"control_type": "page"')
  })
  test('onComplete option fires with a built page config', () => {
    var received = null
    freshDOM()
    // Reset singleton so the beforeEach track's IDs don't conflict with this
    // new track instance (same control names, same root ID).
    if (ControlRegistry_global) ControlRegistry_global.reset()
    // Pass onComplete at construction time so the factory wires it up
    const t = createPageBuilderTrack({ onComplete: function (cfg) { received = cfg } })
    t.goTo(t._pages.length - 1)
    t.next()   // advances past last step → fires _fireComplete → builder calls onComplete(builtConfig)
    expect(received).not.toBeNull()
    expect(received.control_type).toBe('page')
  })
  test('getFullSnapshot includes all three step keys', () => {
    const snap = track.getFullSnapshot()
    expect('identity'  in snap).toBe(true)
    expect('children'  in snap).toBe(true)
    expect('preview'   in snap).toBe(true)
  })
})

// ── createTrackBuilderTrack ───────────────────────────────────────────────────

describe('createTrackBuilderTrack', () => {
  let track

  beforeEach(() => {
    freshDOM()
    track = createTrackBuilderTrack()
  })

  test('has exactly 3 steps', () => {
    expect(track._pages.length).toBe(3)
  })
  test('step 0 is named "identity"', () => {
    expect(track.getStep(0).getName()).toBe('identity')
  })
  test('step 1 is named "structure"', () => {
    expect(track.getStep(1).getName()).toBe('structure')
  })
  test('step 2 is named "preview"', () => {
    expect(track.getStep(2).getName()).toBe('preview')
  })
  test('identity step has 3 controls (name, label, allow_jump)', () => {
    expect(track.getStep('identity')._controls.length).toBe(3)
  })
  test('structure step has 1 control (page_list_builder)', () => {
    expect(track.getStep('structure')._controls.length).toBe(1)
    expect(track.getStep('structure')._controls[0].config.control_type).toBe('page_list_builder')
  })
  test('structure control is named "pages"', () => {
    const ctrl = track.getStep('structure')._controls[0]
    expect(ctrl.getName()).toBe('pages')
  })
  test('wizardFactory is injected into the pages control', () => {
    const ctrl = track.getStep('structure')._controls[0]
    expect(typeof ctrl.config.wizardFactory).toBe('function')
  })
  test('navigating to step 2 updates preview code control', () => {
    track.goTo(2)
    const previewCtrl = track.getStep('preview')._controls.find(c => c.getName() === 'config_json')
    const val = previewCtrl.getValue()
    expect(val).toContain('"control_type": "track"')
  })
  test('onComplete option fires with a built track config', () => {
    var received = null
    freshDOM()
    // Reset singleton so the beforeEach track's IDs don't conflict with this
    // new track instance (same control names, same root ID).
    if (ControlRegistry_global) ControlRegistry_global.reset()
    const t = createTrackBuilderTrack({ onComplete: function (cfg) { received = cfg } })
    t.goTo(t._pages.length - 1)
    t.next()
    expect(received).not.toBeNull()
    expect(received.control_type).toBe('track')
  })
  test('getFullSnapshot includes all three step keys', () => {
    const snap = track.getFullSnapshot()
    expect('identity'  in snap).toBe(true)
    expect('structure' in snap).toBe(true)
    expect('preview'   in snap).toBe(true)
  })
  test('getFullSnapshot structure.pages is an array', () => {
    const snap = track.getFullSnapshot()
    expect(Array.isArray(snap.structure.pages)).toBe(true)
  })
  test('DOM root has tk-track class', () => {
    expect(track.getElement().classList.contains('tk-track')).toBe(true)
  })
  test('step 0 validator blocks next() when name is empty', () => {
    var failed = false
    track.onValidationFail(function () { failed = true })
    // Set name to empty, keep label
    const nameCtrl = track.getStep('identity')._controls.find(c => c.getName() === 'name')
    nameCtrl.setValue('')
    track.next()   // should be blocked
    expect(failed).toBe(true)
    expect(track.getActiveIndex()).toBe(0)
  })
  test('step 0 validator passes when name and label are non-empty', () => {
    track.goTo(0)
    const nameCtrl  = track.getStep('identity')._controls.find(c => c.getName() === 'name')
    const labelCtrl = track.getStep('identity')._controls.find(c => c.getName() === 'label')
    nameCtrl.setValue('my_track')
    labelCtrl.setValue('My Track')
    track.next()
    expect(track.getActiveIndex()).toBe(1)
  })
  test('step 1 validator blocks next() when no pages added', () => {
    var failed = false
    track.goTo(1)
    track.onValidationFail(function () { failed = true })
    track.next()   // pages array is empty → should block
    expect(failed).toBe(true)
    expect(track.getActiveIndex()).toBe(1)
  })
  test('step 1 validator passes when at least one page is added', () => {
    track.goTo(1)
    const pagesCtrl = track.getStep('structure')._controls[0]
    pagesCtrl.setValue([
      { control_type: 'page', name: 'p1', label: 'P1', layout: 'full-width', children: [] },
    ])
    track.next()
    expect(track.getActiveIndex()).toBe(2)
  })
  test('round-trip: fill pages then buildTrackConfig has correct structure', () => {
    const pagesCtrl = track.getStep('structure')._controls[0]
    pagesCtrl.setValue([
      {
        control_type: 'page',
        name: 'my_step', label: 'My Step', layout: 'full-width',
        children: [
          { control_type: 'boolean', name: 'active', label: 'Active', state: true, zone: 'main' },
        ],
      },
    ])
    track.goTo(2)
    const previewCtrl = track.getStep('preview')._controls.find(c => c.getName() === 'config_json')
    const parsed = JSON.parse(previewCtrl.getValue())
    expect(parsed.pages[0].name).toBe('my_step')
    expect(parsed.pages[0].children[0].name).toBe('active')
    expect(parsed.pages[0].children[0].state).toBe(true)
  })
})
