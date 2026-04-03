'use strict'
/**
 * control-bindings-singleton.test.cjs
 *
 * Verifies the ControlRegistry singleton refactoring.
 *
 * Key design points tested here:
 *   - ControlRegistry.instance is the one global registry (singleton).
 *   - ROOT controls (no parent in config) auto-register on construction.
 *   - CHILD controls register when the parent calls appendChild() or
 *     subControls.append() — NOT on construction — to avoid double-registration.
 *   - All IDs are hierarchical paths using '__' as the separator:
 *       rootID__name          (root control)
 *       rootID__parentName__childName   (child)
 *   - fetch(fullPathID) retrieves any registered control.
 *   - subControls is a live view: it yields only direct children and does
 *     NOT include grandchildren.
 *   - ControlRegistry.reset() clears the registry for test isolation.
 */

const { JSDOM } = require('jsdom')

const SEP = '__'

let ControlRegistry, ControlConfiguration
let BooleanControl, CompositeControl, TextInputControl

beforeAll(async () => {
  const boot = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>')
  globalThis.window   = boot.window
  globalThis.document = boot.window.document

  const col  = await import('../../src/ControlCollection.js')
  ControlRegistry      = col.ControlRegistry
  ControlConfiguration = col.ControlConfiguration

  const controls = await import('../../src/controls/index.js')
  BooleanControl   = controls.BooleanControl
  CompositeControl = controls.CompositeControl
  TextInputControl = controls.TextInputControl
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function freshDOM () {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>')
  globalThis.window   = dom.window
  globalThis.document = dom.window.document
}

/** Build a root-level config (no parent).  The control will auto-register. */
function makeCfg (name, controlType, state) {
  const cfg = new ControlConfiguration({ name, label: name, control_type: controlType, state })
  cfg.setRootID('root')
  return cfg
}

/** Build a child config.  The control will NOT auto-register — the parent's
 *  subControls.append() does the registration, giving it a path ID of
 *  parentID__name. */
function makeChildCfg (name, controlType, state, parent) {
  const cfg = new ControlConfiguration({ name, label: name, control_type: controlType, state })
  cfg.setParent(parent)
  return cfg
}

beforeEach(() => {
  freshDOM()
  ControlRegistry.reset()
})

// ── Singleton identity ────────────────────────────────────────────────────────

describe('ControlRegistry singleton identity', () => {
  test('ControlRegistry.instance exists and is defined', () => {
    expect(ControlRegistry.instance).toBeDefined()
  })

  test('ControlRegistry.instance returns the same object on repeated access', () => {
    expect(ControlRegistry.instance).toBe(ControlRegistry.instance)
  })

  test('ControlRegistry.reset() clears the registry — fetch throws afterward', () => {
    const ctrl = new BooleanControl(makeCfg('flag', 'boolean', false))
    const id   = ctrl.getID()
    expect(ControlRegistry.instance.fetch(id)).toBe(ctrl)
    ControlRegistry.reset()
    expect(() => ControlRegistry.instance.fetch(id)).toThrow()
  })
})

// ── Auto-registration of root controls ───────────────────────────────────────

describe('auto-registration on construction (root controls)', () => {
  test('a BooleanControl registers itself — fetch by full path ID returns it', () => {
    const ctrl = new BooleanControl(makeCfg('my_flag', 'boolean', false))
    expect(ControlRegistry.instance.fetch(ctrl.getID())).toBe(ctrl)
  })

  test('ID is rootID__name', () => {
    const ctrl = new BooleanControl(makeCfg('my_flag', 'boolean', false))
    expect(ctrl.getID()).toBe(`root${SEP}my_flag`)
  })

  test('a TextInputControl registers itself', () => {
    const ctrl = new TextInputControl(makeCfg('my_text', 'text_input', 'hello'))
    expect(ControlRegistry.instance.fetch(ctrl.getID())).toBe(ctrl)
  })

  test('a CompositeControl registers itself', () => {
    const ctrl = new CompositeControl(makeCfg('my_composite', 'composite', {}))
    expect(ControlRegistry.instance.fetch(ctrl.getID())).toBe(ctrl)
  })

  test('two root controls with different names both appear in the singleton', () => {
    const a = new BooleanControl(makeCfg('alpha', 'boolean', true))
    const b = new BooleanControl(makeCfg('beta',  'boolean', false))
    expect(ControlRegistry.instance.fetch(a.getID())).toBe(a)
    expect(ControlRegistry.instance.fetch(b.getID())).toBe(b)
  })

  test('fetch throws for an unregistered path ID', () => {
    expect(() => ControlRegistry.instance.fetch('root__nonexistent')).toThrow()
  })

  test('fetch returns the correct control when multiple exist', () => {
    const a = new BooleanControl(makeCfg('x', 'boolean', true))
    const b = new TextInputControl(makeCfg('y', 'text_input', 'hi'))
    expect(ControlRegistry.instance.fetch(a.getID())).toBe(a)
    expect(ControlRegistry.instance.fetch(b.getID())).toBe(b)
    expect(ControlRegistry.instance.fetch(a.getID())).not.toBe(b)
  })
})

// ── Children register when appended, not on construction ─────────────────────

describe('child controls register via appendChild / subControls.append', () => {
  test('child created with parent cfg is NOT in singleton until appended', () => {
    const parent = new CompositeControl(makeCfg('panel', 'composite', {}))
    const child  = new BooleanControl(makeChildCfg('toggle', 'boolean', false, parent))
    // child not yet appended — should not be registered
    expect(() => ControlRegistry.instance.fetch(child.getID())).toThrow()
  })

  test('after appendChild, child is findable in singleton by its full path ID', () => {
    const parent = new CompositeControl(makeCfg('panel2', 'composite', {}))
    const child  = new BooleanControl(makeChildCfg('toggle2', 'boolean', false, parent))
    parent.appendChild(child)
    expect(ControlRegistry.instance.fetch(child.getID())).toBe(child)
  })

  test("child's path ID is parentID__childName", () => {
    const parent = new CompositeControl(makeCfg('par', 'composite', {}))
    const child  = new BooleanControl(makeChildCfg('ch', 'boolean', false, parent))
    parent.appendChild(child)
    expect(child.getID()).toBe(`root${SEP}par${SEP}ch`)
  })

  test('after subControls.append, child is findable in singleton', () => {
    const parent = new CompositeControl(makeCfg('wrapper', 'composite', {}))
    const child  = new TextInputControl(makeChildCfg('label', 'text_input', 'sample', parent))
    parent.subControls.append(child)
    expect(ControlRegistry.instance.fetch(child.getID())).toBe(child)
  })

  test('both parent and child are findable after appendChild', () => {
    const parent = new CompositeControl(makeCfg('p', 'composite', {}))
    const child  = new BooleanControl(makeChildCfg('c', 'boolean', false, parent))
    parent.appendChild(child)
    expect(ControlRegistry.instance.fetch(parent.getID())).toBe(parent)
    expect(ControlRegistry.instance.fetch(child.getID())).toBe(child)
  })

  test('a grandchild is findable globally after being appended', () => {
    const root = new CompositeControl(makeCfg('root_ctrl', 'composite', {}))
    const mid  = new CompositeControl(makeChildCfg('mid_ctrl',  'composite', {}, root))
    root.appendChild(mid)
    const leaf = new BooleanControl(makeChildCfg('leaf_ctrl', 'boolean', true, mid))
    mid.appendChild(leaf)

    expect(ControlRegistry.instance.fetch(root.getID())).toBe(root)
    expect(ControlRegistry.instance.fetch(mid.getID())).toBe(mid)
    expect(ControlRegistry.instance.fetch(leaf.getID())).toBe(leaf)
    // path is three tiers deep
    expect(leaf.getID()).toBe(`root${SEP}root_ctrl${SEP}mid_ctrl${SEP}leaf_ctrl`)
  })
})

// ── subControls is a live view of direct children only ────────────────────────

describe('subControls reflects direct children only', () => {
  test('parent.subControls contains its direct child after appendChild', () => {
    const parent = new CompositeControl(makeCfg('par', 'composite', {}))
    const child  = new BooleanControl(makeChildCfg('ch', 'boolean', false, parent))
    parent.appendChild(child)
    const found = [...parent.subControls].find(c => c.getName() === 'ch')
    expect(found).toBe(child)
  })

  test('parent.subControls does NOT contain the grandchild', () => {
    const parent = new CompositeControl(makeCfg('par2', 'composite', {}))
    const child  = new CompositeControl(makeChildCfg('ch2', 'composite', {}, parent))
    parent.appendChild(child)
    const grand  = new BooleanControl(makeChildCfg('gc', 'boolean', false, child))
    child.appendChild(grand)

    const inParent = [...parent.subControls].find(c => c.getName() === 'gc')
    expect(inParent).toBeUndefined()
    // but it IS findable globally
    expect(ControlRegistry.instance.fetch(grand.getID())).toBe(grand)
  })

  test('subControls.size reflects only direct children', () => {
    const parent = new CompositeControl(makeCfg('par3', 'composite', {}))
    const c1 = new BooleanControl(makeChildCfg('c1', 'boolean', false, parent))
    const c2 = new BooleanControl(makeChildCfg('c2', 'boolean', true,  parent))
    parent.appendChild(c1)
    parent.appendChild(c2)
    expect(parent.subControls.size).toBe(2)
  })
})
