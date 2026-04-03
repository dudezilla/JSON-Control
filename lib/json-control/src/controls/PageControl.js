import { Control, ControlConfiguration } from '../ControlCollection.js'
import { ControlFactory } from '../ControlFactory.js'
import * as Logger from '../ControlLogger.js'

/**
 * @classdesc PageControl — a self-bootstrapping root container that owns
 * globalThis.dudezilla.bindings and drops into document.body (or any element).
 *
 * Unlike CompositeControl (which is a guest — it requires an outer ControlFactory
 * to have already set up the global bindings), PageControl is a HOST: it sets up
 * globalThis.dudezilla itself, making it the entry point for an entire page.
 *
 * It defers to an existing global when one is present (e.g. when run inside
 * TestHarnessControl's isolated sandbox), so test isolation is preserved.
 *
 * Children are appended to the page wrapper in declaration order — no zones,
 * no layout classes.
 *
 * Usage:
 *   PageControl.fromConfig(config).mount(document.body)
 *
 *   // With change listener:
 *   PageControl.fromConfig(config)
 *     .onAnyChange((change, snapshot) => console.log(snapshot))
 *     .mount(document.body)
 *
 * Example config:
 * {
 *   name:         'app',
 *   label:        'My Application',
 *   description:  'Optional subtitle shown below the title',
 *   state:      {},
 *   control_type: 'page',
 *   children: [
 *     { name: 'enabled', label: 'Enable', state: false, control_type: 'boolean' },
 *     { name: 'logs',    label: 'Output', state: [],    control_type: 'log_viewer', height: '300px' },
 *   ]
 * }
 */
class PageControl extends Control {
  /**
   * @param {ControlConfiguration} controlConfig
   */
  constructor (controlConfig) {
    super(controlConfig)

    /** @type {Array<function>} Listeners fired when any child changes. */
    this._changeListeners = []

    /** @type {boolean} True when this PageControl owns globalThis.dudezilla. */
    this._ownedGlobal = false

    this._subControlsBuilt = false

    this._bootstrapGlobal()
    this._buildChildren()
    this.element = this._makeContainerElement()
  }

  // ── Global bootstrap ──────────────────────────────────────────────────────

  /**
   * Set globalThis.dudezilla to point at this control's subControls, but only
   * when no global bindings is already in place.  When running inside
   * TestHarnessControl the harness has already set up an isolated global — we
   * defer to it so test isolation is preserved.
   * @private
   */
  _bootstrapGlobal () {
    if (globalThis.dudezilla && globalThis.dudezilla.bindings) {
      Logger.debug('PageControl', 'Existing global bindings found — deferring (test harness context?)')
      return
    }
    this._ownedGlobal = true
    globalThis.dudezilla = { bindings: this.subControls }
    if (typeof window !== 'undefined') window.dudezilla = { bindings: this.subControls }
    Logger.debug('PageControl', 'Bootstrapped globalThis.dudezilla', { name: this.getName() })
  }

  // ── Child instantiation ───────────────────────────────────────────────────

  /**
   * Instantiate each entry in config.children via ControlFactory.getTypeMap()
   * and register each child in this.subControls in declaration order.
   * @private
   */
  _buildChildren () {
    const typeMap    = ControlFactory.getTypeMap()
    const childConfs = this.config.children || []

    for (const childConfig of childConfs) {
      const ChildClass = typeMap[childConfig.control_type]
      if (!ChildClass) {
        throw new Error(
          'PageControl: unknown child control_type "' + childConfig.control_type +
          '". Registered: ' + Object.keys(typeMap).join(', ')
        )
      }

      const cfg = new ControlConfiguration(Object.assign({}, childConfig))
      cfg.setParent(this)
      const ctrl = new ChildClass(cfg)
      this.appendChild(ctrl)
    }
  }

  // ── DOM construction ──────────────────────────────────────────────────────

  /**
   * Build the page shell — header div followed by child slots.
   * Children are NOT inserted here; buildSubControls() appends them in order.
   * @private
   * @returns {HTMLElement}
   */
  _makeContainerElement () {
    const page   = document.createElement('div')
    page.id        = this.getID()
    page.className = 'pc-page'

    const header   = document.createElement('header')
    header.className = 'pc-header'

    const h1     = document.createElement('h1')
    h1.className = 'pc-title'
    h1.textContent = this.getLabel()
    header.appendChild(h1)

    if (this.config.description) {
      const p     = document.createElement('p')
      p.className = 'pc-description'
      p.textContent = this.config.description
      header.appendChild(p)
    }

    page.appendChild(header)
    return page
  }

  /**
   * Append each child's DOM subtree to the page wrapper in declaration order.
   * Idempotent — safe to call multiple times; children are only appended once.
   * TrackControl relies on this to pre-build all pages then swap them into the
   * viewport without double-appending on subsequent show() calls.
   * @returns {HTMLElement}
   */
  buildSubControls () {
    if (this._subControlsBuilt) return this.getElement()
    this._subControlsBuilt = true
    const page = this.getElement()
    for (const ctrl of this.subControls) {
      try {
        page.appendChild(ctrl.buildSubControls())
      } catch (err) {
        Logger.warning('PageControl.buildSubControls', 'Failed to build child', {
          child: ctrl.getName && ctrl.getName(),
          error: err.message,
        })
      }
    }
    return page
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Mount this page into a DOM element, apply all handlers, and return `this`
   * for chaining.  Typically called as `PageControl.fromConfig(cfg).mount(document.body)`.
   * @param {Element} el - The element to mount into (often document.body).
   * @returns {PageControl} this
   */
  mount (el) {
    el.appendChild(this.buildSubControls())
    this.applyHandlers()
    return this
  }

  /**
   * Register a listener that fires whenever any child control fires eventLinkage.
   * @param {function(stateChange: *, snapshot: Object): void} callback
   * @returns {PageControl} this — chainable
   */
  onAnyChange (callback) {
    this._changeListeners.push(callback)
    return this
  }

  /**
   * Returns a plain-object snapshot { childName: currentValue } for every
   * direct child in insertion order.  JSON-serialisable.
   * @returns {Object.<string,*>}
   */
  getValue () {
    const result = {}
    for (const [name, value] of this.subControls.toValueMap()) {
      result[name] = value
    }
    return result
  }

  /**
   * Deep snapshot — same as getValue() for a flat page; may be overridden by
   * subclasses to recurse into nested CompositeControls.
   * @returns {Object.<string,*>}
   */
  getSnapshot () {
    return this.getValue()
  }

  /**
   * Distribute a set of values to children by name.
   * @param {Object|Map} values - Plain object or Map of { childName → value }.
   */
  setValue (values) {
    const entries = (values instanceof Map)
      ? values.entries()
      : Object.entries(values || {})
    for (const [name, value] of entries) {
      const child = this.getChild(name)
      if (child) child.setValue(value)
    }
  }

  /**
   * Array view of subControls — backward-compatible alias used by code that
   * previously accessed _TrackStep._controls directly.
   * @type {Control[]}
   */
  get _controls () {
    return [...this.subControls]
  }

  /**
   * Find a direct child control by its config.name.
   * @param {string} name
   * @returns {Control|undefined}
   */
  getChild (name) {
    for (const ctrl of this.subControls) {
      if (ctrl.getName() === name) return ctrl
    }
    return undefined
  }

  /**
   * Called when any direct child fires eventLinkage.
   * Notifies all onAnyChange listeners with the stateChange and a current snapshot.
   * Propagates upward if this PageControl is itself nested inside another control.
   * @param {*} stateChange
   */
  onChildEvent (stateChange) {
    const snapshot = this.getSnapshot()
    for (const cb of this._changeListeners) {
      try { cb(stateChange, snapshot) } catch (_) {}
    }
    if (this.isChild()) this.eventLinkage(stateChange)
  }

  /**
   * Release ownership of globalThis.dudezilla and clear change listeners.
   * Call before unmounting or mounting a new PageControl.
   * @returns {PageControl} this
   */
  teardown () {
    if (this._ownedGlobal) {
      if (globalThis.dudezilla && globalThis.dudezilla.bindings === this.subControls) {
        delete globalThis.dudezilla
        if (typeof window !== 'undefined' && window.dudezilla) delete window.dudezilla
        Logger.debug('PageControl', 'globalThis.dudezilla released', { name: this.getName() })
      }
      this._ownedGlobal = false
    }
    this._changeListeners = []
    return this
  }

  // ── Static factory ────────────────────────────────────────────────────────

  /**
   * Convenience factory: accepts a raw config object (or parsed JSON) and
   * returns a fully constructed PageControl ready to mount.
   *
   * @param {Object} config - A page config object with name, label, children, etc.
   * @returns {PageControl}
   */
  static fromConfig (config) {
    const cfg = new ControlConfiguration(Object.assign({}, config))
    cfg.setRootID(config.rootID || config.name || 'page')
    return new PageControl(cfg)
  }
}

PageControl.controlType = 'page'

PageControl.meta = {
  controlType:   'page',
  category:      'composite',
  description:   'Self-bootstrapping root container. Sets up globalThis.dudezilla.bindings and appends children to the page wrapper in declaration order. Exposes mount() / onAnyChange() / teardown() for full page lifecycle management.',
  defaultConfig: {
    name:         'test_page',
    label:        'Test Page',
    description:  'A self-bootstrapping page container.',
    state:      {},
    control_type: 'page',
    children: [
      { name: 'enabled', label: 'Enabled', state: false, control_type: 'boolean' },
      { name: 'verbose', label: 'Verbose', state: false, control_type: 'boolean' },
    ]
  },
  tests: [
    {
      name: 'has two child controls in subControls',
      fn: function (ctrl) { return ctrl.subControls.size === 2 }
    },
    {
      name: 'getValue returns plain object with child names',
      fn: function (ctrl) {
        var v = ctrl.getValue()
        return typeof v === 'object' && v !== null && 'enabled' in v && 'verbose' in v
      }
    },
    {
      name: 'child values match initial config',
      fn: function (ctrl) {
        var v = ctrl.getValue()
        return v.enabled === false && v.verbose === false
      }
    },
    {
      name: 'getChild(name) returns the named child',
      fn: function (ctrl) {
        var c = ctrl.getChild('enabled')
        return c !== undefined && c.getName() === 'enabled'
      }
    },
    {
      name: 'setValue distributes values to children',
      fn: function (ctrl) {
        ctrl.setValue({ enabled: true, verbose: false })
        var v = ctrl.getValue()
        return v.enabled === true && v.verbose === false
      }
    },
    {
      name: 'setValue with a Map distributes values correctly',
      fn: function (ctrl) {
        ctrl.setValue(new Map([['enabled', false], ['verbose', true]]))
        var v = ctrl.getValue()
        return v.enabled === false && v.verbose === true
      }
    },
    {
      name: 'onAnyChange callback fires when onChildEvent is called',
      fn: function (ctrl) {
        var fired = false
        ctrl.onAnyChange(function () { fired = true })
        ctrl.onChildEvent({ test: true })
        return fired === true
      }
    },
    {
      name: 'getSnapshot returns same shape as getValue',
      fn: function (ctrl) {
        var snap = ctrl.getSnapshot()
        var val  = ctrl.getValue()
        return JSON.stringify(snap) === JSON.stringify(val)
      }
    },
    {
      name: 'DOM element has pc-page class',
      fn: function (ctrl) {
        return ctrl.getElement().classList.contains('pc-page')
      }
    },
    {
      name: 'DOM contains h1.pc-title with label text',
      fn: function (ctrl) {
        var h1 = ctrl.getElement().querySelector('h1.pc-title')
        return h1 !== null && h1.textContent === 'Test Page'
      }
    },
    {
      name: 'DOM contains p.pc-description with description text',
      fn: function (ctrl) {
        var p = ctrl.getElement().querySelector('p.pc-description')
        return p !== null && p.textContent === 'A self-bootstrapping page container.'
      }
    },
    {
      name: 'for...of subControls iterates all children',
      fn: function (ctrl) {
        var names = []
        for (var c of ctrl.subControls) { names.push(c.getName()) }
        return names.length === 2 && names[0] === 'enabled' && names[1] === 'verbose'
      }
    },
  ]
}

export { PageControl }
