'use strict'
/**
 * control-bindings-parity.test.cjs
 *
 * Three-part test file:
 *
 *   PART A — LegacyControlRegistry (frozen inline copy)
 *     The original per-instance implementation copied verbatim before the
 *     singleton refactoring.  Duck-typed (no 'instanceof Control' dependency)
 *     so it runs standalone.  These tests must ALWAYS pass — they are the
 *     reference contract.
 *
 *   PART B — Current ControlRegistry (imported from src/)
 *     The same scenarios run against the live class.  These must pass both
 *     before and after the refactoring.
 *
 *   PART C — New hierarchical capabilities
 *     Singleton access, hierarchical path IDs (__ separator), tier-filtered
 *     enumerators.  These FAIL today and will pass after the refactoring.
 */

const { JSDOM } = require('jsdom')

let ControlRegistry

beforeAll(async () => {
  const boot = new JSDOM('<!DOCTYPE html><html><body><div id="rootA"></div><div id="rootB"></div></body></html>')
  globalThis.window   = boot.window
  globalThis.document = boot.window.document

  const mod  = await import('../../src/ControlCollection.js')
  ControlRegistry = mod.ControlRegistry
})

beforeEach(() => {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="rootA"></div><div id="rootB"></div></body></html>')
  globalThis.window   = dom.window
  globalThis.document = dom.window.document
  if (typeof ControlRegistry.reset === 'function') ControlRegistry.reset()
})

// ── Shared mock factory ───────────────────────────────────────────────────────
// Produces plain objects that satisfy the duck-type interface both
// implementations depend on (getID, getName, getValue, isChild, getConfig).

function mockCtrl (id, name, value = null) {
  return {
    getID:     () => id,
    getName:   () => name,
    getValue:  () => value,
    isChild:   () => false,
    getConfig: () => ({ name }),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PART A — LegacyControlRegistry
//
// Verbatim copy of the original class, frozen here so the refactoring cannot
// change this reference.  The instanceof Control check is replaced with a
// duck-type guard so it runs without the full src/ import.
// ─────────────────────────────────────────────────────────────────────────────

class LegacyControlRegistry {
  #data    = new Map()
  #mapping = new Map()

  append (control) {
    if (typeof control.getID !== 'function') {
      throw 'TYPE:\tAn instance of Control is required'
    }
    const id = control.getID()
    if (this.#data.has(id)) throw 'Key Error:\tduplicate'
    this.#data.set(id, control)
    this.#mapping.set(id, this)
  }

  includes (key) { return this.#data.has(key) }

  fetch (key) {
    const ctrl = this.#data.get(key)
    if (ctrl !== undefined) return ctrl
    throw new Error('Key Error:\tkey not found, LOCAL')
  }

  getKeys ()   { return Array.from(this.#data.keys()) }

  forEach (cb) { for (const ctrl of this.#data.values()) cb(ctrl) }

  [Symbol.iterator] () { return this.#data.values() }

  entries () { return this.#data.entries() }

  values ()  { return this.#data.values() }

  keys ()    { return this.#data.keys() }

  get size () { return this.#data.size }

  toValueMap () {
    const result = new Map()
    for (const ctrl of this) result.set(ctrl.getName(), ctrl.getValue())
    return result
  }
}

// ── Shared scenario runner ────────────────────────────────────────────────────
// Every scenario is a function that accepts a ControlRegistry-compatible
// instance and runs assertions against it.  The same scenario is executed in
// both Part A and Part B so the contract is enforced against both.

function scenario_appendAndFetch (bindings) {
  const a = mockCtrl('ws__rootA__flag', 'flag', true)
  bindings.append(a)
  expect(bindings.fetch('ws__rootA__flag')).toBe(a)
}

function scenario_includes (bindings) {
  const a = mockCtrl('ws__rootA__flag', 'flag')
  bindings.append(a)
  expect(bindings.includes('ws__rootA__flag')).toBe(true)
  expect(bindings.includes('ws__rootA__nonexistent')).toBe(false)
}

function scenario_size (bindings) {
  expect(bindings.size).toBe(0)
  bindings.append(mockCtrl('ws__rootA__a', 'a'))
  expect(bindings.size).toBe(1)
  bindings.append(mockCtrl('ws__rootA__b', 'b'))
  expect(bindings.size).toBe(2)
}

function scenario_duplicateKeyThrows (bindings) {
  bindings.append(mockCtrl('ws__rootA__dup', 'dup'))
  expect(() => bindings.append(mockCtrl('ws__rootA__dup', 'dup'))).toThrow()
}

function scenario_fetchUnknownThrows (bindings) {
  expect(() => bindings.fetch('ws__rootA__ghost')).toThrow()
}

function scenario_forEach (bindings) {
  const a = mockCtrl('ws__rootA__x', 'x')
  const b = mockCtrl('ws__rootA__y', 'y')
  bindings.append(a)
  bindings.append(b)
  const seen = []
  bindings.forEach(ctrl => seen.push(ctrl))
  expect(seen).toContain(a)
  expect(seen).toContain(b)
  expect(seen).toHaveLength(2)
}

function scenario_symbolIterator (bindings) {
  const a = mockCtrl('ws__rootA__i', 'i')
  const b = mockCtrl('ws__rootA__j', 'j')
  bindings.append(a)
  bindings.append(b)
  const collected = [...bindings]
  expect(collected).toContain(a)
  expect(collected).toContain(b)
  expect(collected).toHaveLength(2)
}

function scenario_entries (bindings) {
  const a = mockCtrl('ws__rootA__p', 'p')
  bindings.append(a)
  const pairs = [...bindings.entries()]
  expect(pairs).toHaveLength(1)
  expect(pairs[0][0]).toBe('ws__rootA__p')
  expect(pairs[0][1]).toBe(a)
}

function scenario_keys (bindings) {
  bindings.append(mockCtrl('ws__rootA__k1', 'k1'))
  bindings.append(mockCtrl('ws__rootA__k2', 'k2'))
  const k = [...bindings.keys()]
  expect(k).toContain('ws__rootA__k1')
  expect(k).toContain('ws__rootA__k2')
}

function scenario_getKeys (bindings) {
  bindings.append(mockCtrl('ws__rootA__g1', 'g1'))
  const arr = bindings.getKeys()
  expect(Array.isArray(arr)).toBe(true)
  expect(arr).toContain('ws__rootA__g1')
}

function scenario_toValueMap (bindings) {
  bindings.append(mockCtrl('ws__rootA__v1', 'alpha', 42))
  bindings.append(mockCtrl('ws__rootA__v2', 'beta',  'hi'))
  const m = bindings.toValueMap()
  expect(m.get('alpha')).toBe(42)
  expect(m.get('beta')).toBe('hi')
}

function scenario_multipleRootNamespaces (bindings) {
  // Controls in rootA and rootB coexist in the same registry
  const a1 = mockCtrl('ws__rootA__ctrl1', 'ctrl1')
  const b1 = mockCtrl('ws__rootB__ctrl1', 'ctrl1')  // same short name, different root
  bindings.append(a1)
  bindings.append(b1)
  expect(bindings.fetch('ws__rootA__ctrl1')).toBe(a1)
  expect(bindings.fetch('ws__rootB__ctrl1')).toBe(b1)
  expect(bindings.size).toBe(2)
}

// ── PART A — run all scenarios against LegacyControlRegistry ─────────────────

describe('LegacyControlRegistry (frozen reference)', () => {
  let legacy
  beforeEach(() => { legacy = new LegacyControlRegistry() })

  test('append + fetch',              () => scenario_appendAndFetch(legacy))
  test('includes',                    () => scenario_includes(legacy))
  test('size',                        () => scenario_size(legacy))
  test('duplicate key throws',        () => scenario_duplicateKeyThrows(legacy))
  test('fetch unknown key throws',    () => scenario_fetchUnknownThrows(legacy))
  test('forEach',                     () => scenario_forEach(legacy))
  test('Symbol.iterator (for...of)',  () => scenario_symbolIterator(legacy))
  test('entries()',                   () => scenario_entries(legacy))
  test('keys()',                      () => scenario_keys(legacy))
  test('getKeys()',                   () => scenario_getKeys(legacy))
  test('toValueMap()',                () => scenario_toValueMap(legacy))
  test('multiple root namespaces',    () => scenario_multipleRootNamespaces(legacy))
})

// ── PART B — run same scenarios against current ControlRegistry (src/) ────────

describe('ControlRegistry (src/) — must match Legacy contract', () => {
  let bindings
  beforeEach(() => {
    if (typeof ControlRegistry.reset === 'function') ControlRegistry.reset()
    bindings = new ControlRegistry()
  })

  test('append + fetch',              () => scenario_appendAndFetch(bindings))
  test('includes',                    () => scenario_includes(bindings))
  test('size',                        () => scenario_size(bindings))
  test('duplicate key throws',        () => scenario_duplicateKeyThrows(bindings))
  test('fetch unknown key throws',    () => scenario_fetchUnknownThrows(bindings))
  test('forEach',                     () => scenario_forEach(bindings))
  test('Symbol.iterator (for...of)',  () => scenario_symbolIterator(bindings))
  test('entries()',                   () => scenario_entries(bindings))
  test('keys()',                      () => scenario_keys(bindings))
  test('getKeys()',                   () => scenario_getKeys(bindings))
  test('toValueMap()',                () => scenario_toValueMap(bindings))
  test('multiple root namespaces',    () => scenario_multipleRootNamespaces(bindings))
})

// ── PART C — new hierarchical capabilities (FAIL until refactoring done) ──────

describe('ControlRegistry singleton (new — will fail until refactored)', () => {
  test('ControlRegistry.instance is the same object on repeated access', () => {
    expect(ControlRegistry.instance).toBeDefined()
    expect(ControlRegistry.instance).toBe(ControlRegistry.instance)
  })

  test('ControlRegistry.reset() clears the registry', () => {
    ControlRegistry.instance.append(mockCtrl('ws__rootA__temp', 'temp'))
    ControlRegistry.reset()
    expect(() => ControlRegistry.instance.fetch('ws__rootA__temp')).toThrow()
  })
})

describe('__ separator — path tier logic (new — will fail until refactored)', () => {
  const SEP = '__'

  test('splitting an ID produces the correct tier array', () => {
    const id = 'workspace__rootA__track1__pageA__header'
    expect(id.split(SEP)).toEqual(['workspace', 'rootA', 'track1', 'pageA', 'header'])
  })

  test('depth is tiers.length - 1', () => {
    const id = 'workspace__rootA__track1'
    expect(id.split(SEP).length - 1).toBe(2)
  })

  test('parent path is all-but-last joined', () => {
    const id    = 'workspace__rootA__track1__pageA'
    const parts = id.split(SEP)
    expect(parts.slice(0, -1).join(SEP)).toBe('workspace__rootA__track1')
  })

  test('getControlsByPath returns direct children only', () => {
    const reg  = ControlRegistry.instance
    const root = mockCtrl('ws__rootA',           'rootA')
    const c1   = mockCtrl('ws__rootA__ctrl1',    'ctrl1')
    const c2   = mockCtrl('ws__rootA__ctrl2',    'ctrl2')
    const gc   = mockCtrl('ws__rootA__ctrl1__child', 'child')
    reg.append(root)
    reg.append(c1)
    reg.append(c2)
    reg.append(gc)

    const children = [...reg.getControlsByPath('ws__rootA__*')]
    const ids = children.map(c => c.getID())
    expect(ids).toContain('ws__rootA__ctrl1')
    expect(ids).toContain('ws__rootA__ctrl2')
    expect(ids).not.toContain('ws__rootA__ctrl1__child')
    expect(children).toHaveLength(2)
  })

  test('getControlsByPath with ** returns all descendants', () => {
    const reg = ControlRegistry.instance
    reg.append(mockCtrl('ws__rootA__a',       'a'))
    reg.append(mockCtrl('ws__rootA__a__b',    'b'))
    reg.append(mockCtrl('ws__rootA__a__b__c', 'c'))

    const all = [...reg.getControlsByPath('ws__rootA__**')]
    const ids = all.map(c => c.getID())
    expect(ids).toContain('ws__rootA__a')
    expect(ids).toContain('ws__rootA__a__b')
    expect(ids).toContain('ws__rootA__a__b__c')
  })
})

describe('multiple virtual roots — coexistence and switching (new)', () => {
  test('controls in rootA and rootB share the same registry', () => {
    const reg = ControlRegistry.instance
    reg.append(mockCtrl('ws__rootA__flag', 'flag'))
    reg.append(mockCtrl('ws__rootB__flag', 'flag'))
    expect(reg.fetch('ws__rootA__flag').getID()).toBe('ws__rootA__flag')
    expect(reg.fetch('ws__rootB__flag').getID()).toBe('ws__rootB__flag')
  })

  test('getControlsByPath scopes to one root only', () => {
    const reg = ControlRegistry.instance
    reg.append(mockCtrl('ws__rootA__x', 'x'))
    reg.append(mockCtrl('ws__rootB__x', 'x'))

    const inA = [...reg.getControlsByPath('ws__rootA__*')]
    const inB = [...reg.getControlsByPath('ws__rootB__*')]
    expect(inA).toHaveLength(1)
    expect(inA[0].getID()).toBe('ws__rootA__x')
    expect(inB).toHaveLength(1)
    expect(inB[0].getID()).toBe('ws__rootB__x')
  })
})
