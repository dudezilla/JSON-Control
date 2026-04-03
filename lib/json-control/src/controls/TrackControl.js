import { Control, ControlConfiguration } from '../ControlCollection.js'
import { ControlFactory } from '../ControlFactory.js'
import * as Logger from '../ControlLogger.js'

/**
 * @classdesc TrackControl — an ordered stack of Pages related to a theme.
 *
 * Pages are built eagerly at construction time so field values are preserved
 * across navigation.  Switching pages is a DOM swap — the outgoing page's
 * element is removed from the viewport div and the incoming page's pre-built
 * element is moved in.  No CSS class toggling, no hidden elements.
 *
 * Each entry in config.children is a page config (control_type: "page").
 * config.pages is also accepted for backward compatibility.
 *
 * Navigation:
 *   track.next()         advance one page (fires onComplete on the last page)
 *   track.prev()         go back one page
 *   track.goTo(index)    jump to any page (respects allowJump config)
 *
 * State:
 *   track.getFullSnapshot()         → { pageName: { fieldName: value, … }, … }
 *   track.getActiveIndex()          → current page index (0-based)
 *   track.getCurrentPage()          → the active PageControl instance
 *   track.getPage(index|name)       → any page by index or name
 *   track.setPageValidator(i, fn)   → fn(snapshot) must return true to advance
 *
 * Example config:
 * {
 *   name:         'guitar_basics',
 *   label:        'Guitar Basics',
 *   state:        0,
 *   control_type: 'track',
 *   allowJump:    false,
 *   children: [
 *     { control_type: 'page', name: 'intro',  label: 'Introduction',
 *       children: [ { name: 'done', label: 'Done', state: false, control_type: 'boolean' } ] },
 *     { control_type: 'page', name: 'chords', label: 'Basic Chords',
 *       children: [ { name: 'practiced', label: 'Practiced', state: false, control_type: 'boolean' } ] },
 *   ]
 * }
 */
class TrackControl extends Control {
  constructor (controlConfig) {
    super(controlConfig)

    this._pages              = []   // PageControl[]  — built eagerly, swapped via viewport
    this._activeIndex        = 0
    this._ownedGlobal        = false
    this._validators         = {}   // index → fn(snapshot) → bool
    this._pageChangeListeners = []
    this._completeListeners  = []
    this._validationFailListeners = []

    // DOM refs set during container build
    this._navDots       = []
    this._connectors    = []
    this._stepLabelEl   = null
    this._stepCounterEl = null
    this._btnPrev       = null
    this._btnNext       = null
    this._viewportEl    = null  // the single swap div

    this._bootstrapGlobal()
    this._buildPages()
    this.element = this._makeContainerElement()
  }

  // ── Global bootstrap ──────────────────────────────────────────────────────

  _bootstrapGlobal () {
    if (globalThis.dudezilla && globalThis.dudezilla.bindings) {
      Logger.debug('TrackControl', 'Existing global found — deferring (test harness context?)')
      return
    }
    this._ownedGlobal = true
    globalThis.dudezilla = { bindings: this.subControls }
    if (typeof window !== 'undefined') window.dudezilla = { bindings: this.subControls }
    Logger.debug('TrackControl', 'Bootstrapped globalThis.dudezilla', { name: this.getName() })
  }

  // ── Page instantiation ────────────────────────────────────────────────────

  /**
   * Build a PageControl for each entry in config.children (or config.pages).
   * Each page gets a scoped rootID to prevent ID collisions across tracks.
   * Missing control_type and state are defaulted so that old-style step
   * descriptors (no control_type / state) continue to work.
   * @private
   */
  _buildPages () {
    const typeMap   = ControlFactory.getTypeMap()
    const PageCtrl  = typeMap['page']
    if (!PageCtrl) throw new Error('TrackControl: page control type not registered')

    const pageConfs = this.config.children || this.config.pages || []

    for (const pageConf of pageConfs) {
      const scopedConf = Object.assign(
        { control_type: 'page', state: {} },
        pageConf,
        { rootID: this.getID() + '__' + pageConf.name }
      )
      const page = PageCtrl.fromConfig(scopedConf)
      this._pages.push(page)
    }
  }

  // ── DOM construction ──────────────────────────────────────────────────────

  _makeContainerElement () {
    const wrapper   = document.createElement('div')
    wrapper.id        = this.getID()
    wrapper.className = 'tk-track'

    wrapper.appendChild(this._makeTopNav())

    // Viewport — single swap area; pages are moved in/out here
    this._viewportEl = document.createElement('div')
    this._viewportEl.className = 'tk-viewport'
    wrapper.appendChild(this._viewportEl)

    wrapper.appendChild(this._makeBottomNav())

    this._updateNav()

    // Show the initial page
    if (this._pages.length > 0) {
      this._pages[0].buildSubControls()
      this._viewportEl.appendChild(this._pages[0].getElement())
    }

    return wrapper
  }

  _makeTopNav () {
    const nav   = document.createElement('div')
    nav.className = 'tk-nav-top'

    const progress   = document.createElement('div')
    progress.className = 'tk-progress'

    for (var i = 0; i < this._pages.length; i++) {
      if (i > 0) {
        const conn   = document.createElement('span')
        conn.className = 'tk-connector'
        this._connectors.push(conn)
        progress.appendChild(conn)
      }

      const dot   = document.createElement('button')
      dot.className   = 'tk-dot' + (this.config.allowJump ? ' jumpable' : '')
      dot.textContent = String(i + 1)
      dot.dataset.stepIndex = String(i)
      dot.type = 'button'

      if (this.config.allowJump) {
        ;(function (track, idx) {
          dot.addEventListener('click', function () { track.goTo(idx) })
        })(this, i)
      }

      this._navDots.push(dot)
      progress.appendChild(dot)
    }

    nav.appendChild(progress)

    const lbl   = document.createElement('span')
    lbl.className = 'tk-step-label'
    this._stepLabelEl = lbl
    nav.appendChild(lbl)

    return nav
  }

  _makeBottomNav () {
    const bar   = document.createElement('div')
    bar.className = 'tk-nav-bottom'

    const prev   = document.createElement('button')
    prev.className   = 'tk-btn-prev'
    prev.type        = 'button'
    prev.textContent = '← Back'
    prev.addEventListener('click', () => this.prev())
    this._btnPrev = prev

    const counter   = document.createElement('span')
    counter.className = 'tk-step-counter'
    this._stepCounterEl = counter

    const next   = document.createElement('button')
    next.className   = 'tk-btn-next'
    next.type        = 'button'
    next.textContent = 'Next →'
    next.addEventListener('click', () => this.next())
    this._btnNext = next

    bar.appendChild(prev)
    bar.appendChild(counter)
    bar.appendChild(next)
    return bar
  }

  // ── Nav state sync ────────────────────────────────────────────────────────

  _updateNav () {
    const idx   = this._activeIndex
    const total = this._pages.length

    for (var i = 0; i < this._navDots.length; i++) {
      const dot = this._navDots[i]
      dot.classList.toggle('active',    i === idx)
      dot.classList.toggle('completed', i < idx)
    }

    for (var j = 0; j < this._connectors.length; j++) {
      this._connectors[j].classList.toggle('completed', j < idx)
    }

    if (this._stepLabelEl && this._pages[idx]) {
      this._stepLabelEl.textContent = this._pages[idx].getLabel()
    }

    if (this._stepCounterEl) {
      this._stepCounterEl.textContent = (idx + 1) + ' / ' + total
    }

    if (this._btnPrev) {
      this._btnPrev.disabled = (idx === 0)
    }

    if (this._btnNext) {
      const isLast = (idx === total - 1)
      this._btnNext.textContent = isLast ? 'Complete ✓' : 'Next →'
      this._btnNext.classList.toggle('complete', isLast)
    }
  }

  /**
   * Swap the viewport to show page at index.
   * Removes the current page's element from the viewport, builds the incoming
   * page's DOM if not yet built, then appends it.
   * @private
   */
  _activateStep (index) {
    if (!this._viewportEl) return

    // Detach current content
    while (this._viewportEl.firstChild) {
      this._viewportEl.removeChild(this._viewportEl.firstChild)
    }

    this._activeIndex = index

    const page = this._pages[index]
    if (page) {
      page.buildSubControls()  // idempotent — no-op if already built
      this._viewportEl.appendChild(page.getElement())
    }

    this._updateNav()
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  /**
   * Advance to the next page.  Fires the validation gate for the current page
   * (if set), then transitions.  Fires onComplete when advancing past the last page.
   * @returns {TrackControl} this — chainable
   */
  next () {
    const from = this._activeIndex
    const validator = this._validators[from]

    if (validator) {
      const snap = this._pages[from] ? this._pages[from].getValue() : {}
      if (!validator(snap)) {
        this._fireValidationFail(from, snap)
        return this
      }
    }

    if (from >= this._pages.length - 1) {
      this._fireComplete()
      return this
    }

    this._activateStep(from + 1)
    this._firePageChange(from, this._activeIndex)
    return this
  }

  /**
   * Go back to the previous page.
   * @returns {TrackControl} this — chainable
   */
  prev () {
    if (this._activeIndex <= 0) return this
    const from = this._activeIndex
    this._activateStep(from - 1)
    this._firePageChange(from, this._activeIndex)
    return this
  }

  /**
   * Jump to any page by index.  Requires `allowJump: true` in config when
   * called via the UI dots; this method can always be called programmatically.
   * @param {number} index
   * @returns {TrackControl} this — chainable
   */
  goTo (index) {
    if (index < 0 || index >= this._pages.length) return this
    if (index === this._activeIndex) return this
    const from = this._activeIndex
    this._activateStep(index)
    this._firePageChange(from, index)
    return this
  }

  // ── Event bus ─────────────────────────────────────────────────────────────

  /**
   * Register a callback fired whenever the active page changes.
   * Signature: (fromIndex, toIndex, snapshot) → void
   * @param {function} callback
   * @returns {TrackControl} this — chainable
   */
  onPageChange (callback) {
    this._pageChangeListeners.push(callback)
    return this
  }

  /**
   * Register a callback fired when the user advances past the last page.
   * Receives the full snapshot of all pages.
   * @param {function} callback
   * @returns {TrackControl} this — chainable
   */
  onComplete (callback) {
    this._completeListeners.push(callback)
    return this
  }

  /**
   * Register a callback fired when a validator returns false.
   * Signature: (pageIndex, snapshot) → void
   * @param {function} callback
   * @returns {TrackControl} this — chainable
   */
  onValidationFail (callback) {
    this._validationFailListeners.push(callback)
    return this
  }

  _firePageChange (from, to) {
    const snap = this.getFullSnapshot()
    for (const cb of this._pageChangeListeners) {
      try { cb(from, to, snap) } catch (_) {}
    }
  }

  _fireComplete () {
    const snap = this.getFullSnapshot()
    for (const cb of this._completeListeners) {
      try { cb(snap) } catch (_) {}
    }
  }

  _fireValidationFail (index, snap) {
    for (const cb of this._validationFailListeners) {
      try { cb(index, snap) } catch (_) {}
    }
  }

  /** Called by child events — forwards to page change listeners. */
  onChildEvent (stateChange) {
    if (this.isChild()) this.eventLinkage(stateChange)
  }

  // ── Validators ────────────────────────────────────────────────────────────

  /**
   * Register a validation gate for a page.
   * fn(snapshot) must return true for next() to advance past that page.
   * @param {number} pageIndex
   * @param {function} fn
   * @returns {TrackControl} this — chainable
   */
  setPageValidator (pageIndex, fn) {
    this._validators[pageIndex] = fn
    return this
  }

  // ── Accessors ─────────────────────────────────────────────────────────────

  /** @returns {number} Zero-based index of the currently visible page. */
  getActiveIndex () { return this._activeIndex }

  /** @returns {PageControl} The currently active page. */
  getCurrentPage () { return this._pages[this._activeIndex] }

  /** Alias for getCurrentPage() — backward compat. */
  getCurrentStep () { return this.getCurrentPage() }

  /**
   * Retrieve a page by index or by name.
   * @param {number|string} indexOrName
   * @returns {PageControl|undefined}
   */
  getPage (indexOrName) {
    if (typeof indexOrName === 'number') return this._pages[indexOrName]
    return this._pages.find(function (p) { return p.getName() === indexOrName })
  }

  /** Alias for getPage() — backward compat. */
  getStep (indexOrName) { return this.getPage(indexOrName) }

  /**
   * Snapshot of the currently active page's values only.
   * @returns {Object.<string,*>}
   */
  getValue () {
    return this._pages[this._activeIndex]
      ? this._pages[this._activeIndex].getValue()
      : {}
  }

  /**
   * Snapshot of every page's values, keyed by page name.
   * @returns {Object.<string, Object.<string,*>>}
   */
  getFullSnapshot () {
    const result = {}
    for (const page of this._pages) {
      result[page.getName()] = page.getValue()
    }
    return result
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /** @override — element is fully built in the constructor. */
  buildSubControls () {
    return this.getElement()
  }

  /** @override — apply handlers to every page. */
  applyHandlers () {
    for (const page of this._pages) {
      page.applyHandlers()
    }
  }

  /**
   * Mount into a DOM element, apply all handlers, return this for chaining.
   * @param {Element} el
   * @returns {TrackControl}
   */
  mount (el) {
    el.appendChild(this.buildSubControls())
    this.applyHandlers()
    return this
  }

  /**
   * Release global ownership and clear all listeners.
   * @returns {TrackControl} this
   */
  teardown () {
    if (this._ownedGlobal) {
      if (globalThis.dudezilla && globalThis.dudezilla.bindings === this.subControls) {
        delete globalThis.dudezilla
        if (typeof window !== 'undefined' && window.dudezilla) delete window.dudezilla
      }
      this._ownedGlobal = false
    }
    this._pageChangeListeners    = []
    this._completeListeners      = []
    this._validationFailListeners = []
    return this
  }

  // ── Static factory ────────────────────────────────────────────────────────

  /**
   * Accepts a raw config object and returns a ready-to-mount TrackControl.
   * @param {Object} config
   * @returns {TrackControl}
   */
  static fromConfig (config) {
    const cfg = new ControlConfiguration(Object.assign({}, config))
    cfg.setRootID(config.rootID || config.name || 'track')
    return new TrackControl(cfg)
  }
}

TrackControl.controlType = 'track'

TrackControl.meta = {
  controlType:   'track',
  category:      'composite',
  description:   'Ordered stack of Pages related to a theme. Pages are built eagerly; navigation swaps the active page\'s element in and out of a single viewport div. Provides next() / prev() / goTo() navigation, per-page validation gates, onComplete / onPageChange event hooks, and getFullSnapshot().',
  defaultConfig: {
    name:         'test_track',
    label:        'Test Track',
    state:        0,
    control_type: 'track',
    allowJump:    false,
    children: [
      {
        control_type: 'page',
        name:         'step_a',
        label:        'Step A',
        children: [ { name: 'alpha', label: 'Alpha', state: false, control_type: 'boolean' } ],
      },
      {
        control_type: 'page',
        name:         'step_b',
        label:        'Step B',
        children: [ { name: 'beta', label: 'Beta', state: false, control_type: 'boolean' } ],
      },
    ],
  },
  tests: [
    {
      name: 'has two pages',
      fn: function (ctrl) { return ctrl._pages.length === 2 },
    },
    {
      name: 'getActiveIndex returns 0 initially',
      fn: function (ctrl) { return ctrl.getActiveIndex() === 0 },
    },
    {
      name: 'getCurrentPage returns step_a initially',
      fn: function (ctrl) { return ctrl.getCurrentPage().getName() === 'step_a' },
    },
    {
      name: 'getPage(0) returns step_a',
      fn: function (ctrl) { return ctrl.getPage(0).getName() === 'step_a' },
    },
    {
      name: 'getPage("step_b") finds page by name',
      fn: function (ctrl) { return ctrl.getPage('step_b').getName() === 'step_b' },
    },
    {
      name: 'getValue returns current page snapshot',
      fn: function (ctrl) {
        var v = ctrl.getValue()
        return typeof v === 'object' && v !== null && 'alpha' in v
      },
    },
    {
      name: 'getFullSnapshot returns all pages keyed by name',
      fn: function (ctrl) {
        var snap = ctrl.getFullSnapshot()
        return 'step_a' in snap && 'step_b' in snap
      },
    },
    {
      name: 'next() advances to page 1',
      fn: function (ctrl) {
        ctrl.goTo(0)
        ctrl.next()
        return ctrl.getActiveIndex() === 1
      },
    },
    {
      name: 'prev() goes back to page 0',
      fn: function (ctrl) {
        ctrl.goTo(1)
        ctrl.prev()
        return ctrl.getActiveIndex() === 0
      },
    },
    {
      name: 'goTo(1) jumps to page 1',
      fn: function (ctrl) {
        ctrl.goTo(0)
        ctrl.goTo(1)
        return ctrl.getActiveIndex() === 1
      },
    },
    {
      name: 'onPageChange callback fires on next()',
      fn: function (ctrl) {
        ctrl.goTo(0)
        var fired = false
        ctrl.onPageChange(function () { fired = true })
        ctrl.next()
        return fired === true
      },
    },
    {
      name: 'onComplete fires when advancing past the last page',
      fn: function (ctrl) {
        ctrl.goTo(1)
        var fired = false
        ctrl.onComplete(function () { fired = true })
        ctrl.next()
        return fired === true
      },
    },
    {
      name: 'validator blocks next() when returning false',
      fn: function (ctrl) {
        ctrl.goTo(0)
        ctrl.setPageValidator(0, function () { return false })
        ctrl.next()
        return ctrl.getActiveIndex() === 0
      },
    },
    {
      name: 'onValidationFail fires when validator blocks',
      fn: function (ctrl) {
        ctrl.goTo(0)
        var fired = false
        ctrl.setPageValidator(0, function () { return false })
        ctrl.onValidationFail(function () { fired = true })
        ctrl.next()
        return fired === true
      },
    },
    {
      name: 'DOM has tk-track wrapper',
      fn: function (ctrl) { return ctrl.getElement().classList.contains('tk-track') },
    },
    {
      name: 'DOM has tk-viewport div',
      fn: function (ctrl) { return ctrl.getElement().querySelector('.tk-viewport') !== null },
    },
    {
      name: 'viewport shows the active page element',
      fn: function (ctrl) {
        ctrl.goTo(0)
        var vp = ctrl.getElement().querySelector('.tk-viewport')
        return vp !== null && vp.children.length === 1
      },
    },
    {
      name: 'nav dots present (one per page)',
      fn: function (ctrl) {
        return ctrl.getElement().querySelectorAll('.tk-dot').length === 2
      },
    },
    {
      name: 'prev button disabled on first page',
      fn: function (ctrl) {
        ctrl.goTo(0)
        var btn = ctrl.getElement().querySelector('.tk-btn-prev')
        return btn !== null && btn.disabled === true
      },
    },
    {
      name: 'next button says Complete on last page',
      fn: function (ctrl) {
        ctrl.goTo(ctrl._pages.length - 1)
        var btn = ctrl.getElement().querySelector('.tk-btn-next')
        return btn !== null && btn.textContent.includes('Complete')
      },
    },
    {
      name: 'getCurrentStep() aliases getCurrentPage()',
      fn: function (ctrl) {
        return ctrl.getCurrentStep() === ctrl.getCurrentPage()
      },
    },
    {
      name: 'getStep() aliases getPage()',
      fn: function (ctrl) {
        return ctrl.getStep(0) === ctrl.getPage(0)
      },
    },
  ],
}

export { TrackControl }
