import { Control, ControlConfiguration, ControlRegistry } from '../ControlCollection.js'
import { ControlFactory } from '../ControlFactory.js'
import * as Logger from '../ControlLogger.js'

/**
 * @classdesc TestHarnessControl
 *
 * Wraps any other control, runs its .meta.tests suite, and renders a
 * PASS / FAIL result table inline in the page.
 *
 * The target control is identified by its control_type string passed as
 * `config_class` in the config. The class is resolved at runtime via
 * ControlFactory.getTypeMap() — safe despite the circular module reference
 * because the lookup only happens inside _run(), after all modules are loaded.
 *
 * Example usage (from page.js):
 *
 *   const cfg = new ControlConfiguration({
 *     name:         'harness_boolean',
 *     label:        'boolean tests',
 *     state:      'pending',
 *     control_type: 'test_harness',
 *     config_class: 'boolean',
 *   })
 *   cfg.setRootID('root')
 *   const harness = new TestHarnessControl(cfg)
 *   root.appendChild(harness.buildSubControls())
 */
class TestHarnessControl extends Control {
  constructor (controlConfig) {
    super(controlConfig)
    this.element = this._makeShell()
    this._run()
  }

  // ── Shell element ──────────────────────────────────────────────────────────

  _makeShell () {
    var el = document.createElement('div')
    el.id = this.getID()
    return el
  }

  // ── Test execution ─────────────────────────────────────────────────────────

  _run () {
    var cfg         = this.getConfig()
    var configClass = cfg.config_class
    var ctx         = 'TestHarnessControl._run'

    // ── Guard: config_class required ────────────────────────────────────────
    if (!configClass) {
      Logger.critical(ctx, 'No config_class provided in config')
      return this._renderError('TestHarnessControl: no config_class provided in config')
    }

    ctx = configClass

    // ── Guard: resolve class from type map ──────────────────────────────────
    var TargetClass
    try {
      TargetClass = ControlFactory.getTypeMap()[configClass]
    } catch (err) {
      Logger.critical(ctx, 'Failed to access type map', { configClass: configClass, error: err.message })
      return this._renderError('TestHarnessControl: type map unavailable — ' + err.message)
    }

    if (!TargetClass) {
      Logger.critical(ctx, 'Unknown config_class', { configClass: configClass })
      return this._renderError('TestHarnessControl: unknown config_class "' + configClass + '"')
    }
    if (!TargetClass.meta) {
      Logger.critical(ctx, 'Target class has no .meta', { configClass: configClass })
      return this._renderError('TestHarnessControl: ' + configClass + ' has no .meta')
    }

    var meta          = TargetClass.meta
    var defaultConfig = meta.defaultConfig

    if (!defaultConfig) {
      Logger.critical(ctx, 'Target class has no .meta.defaultConfig', { configClass: configClass })
      return this._renderError('TestHarnessControl: ' + (meta.controlType || configClass) + ' has no .meta.defaultConfig')
    }

    if (!meta.tests || meta.tests.length === 0) {
      Logger.message(ctx, 'No tests defined — skipping run', { configClass: configClass })
      return this._renderEmpty(meta.controlType)
    }

    Logger.message(ctx, 'Test run started', {
      configClass: configClass,
      testCount:   meta.tests.length,
    })

    // ── Setup: isolated bindings + scratch DOM node ─────────────────────────
    var savedDudezilla = globalThis.dudezilla
    var bindings       = new ControlRegistry()
    globalThis.dudezilla = { bindings: bindings }

    var scratch = document.createElement('div')
    scratch.id  = '__test_harness_scratch__'
    scratch.setAttribute('aria-hidden', 'true')
    scratch.style.cssText = 'position:absolute;left:-9999px;top:-9999px;visibility:hidden;'

    try {
      document.body.appendChild(scratch)
    } catch (err) {
      Logger.critical(ctx, 'Failed to attach scratch element to DOM', { error: err.message })
      globalThis.dudezilla = savedDudezilla
      return this._renderError('TestHarnessControl: DOM setup failed — ' + err.message)
    }

    // ── Instantiate target control ──────────────────────────────────────────
    var ctrl    = null
    var results = []

    try {
      Logger.debug(ctx, 'Instantiating target control', { configClass: configClass })
      var ccfg = new ControlConfiguration(Object.assign({}, defaultConfig))
      ccfg.setRootID('__test_harness_scratch__')
      ctrl = new TargetClass(ccfg)
      bindings.append(ctrl)
      scratch.appendChild(ctrl.buildSubControls())
      Logger.debug(ctx, 'Target control instantiated successfully', { configClass: configClass })
    } catch (err) {
      Logger.warning(ctx, 'Failed to instantiate target control', {
        configClass: configClass,
        error:       err.message,
      })
      try { document.body.removeChild(scratch) } catch (_) {}
      globalThis.dudezilla = savedDudezilla
      return this._renderError('Failed to instantiate ' + (meta.controlType || configClass) + ': ' + err.message)
    }

    // ── Run each test ────────────────────────────────────────────────────────
    meta.tests.forEach(function (test) {
      var passed = false
      var error  = null
      try {
        var result = test.fn(ctrl)
        passed = (result === true || (typeof result !== 'undefined' && result !== false && result !== null && result !== 0 && result !== ''))
      } catch (e) {
        passed = false
        error  = e.message
      }

      if (passed) {
        Logger.message(ctx, 'PASS: ' + test.name, { configClass: configClass })
      } else {
        Logger.warning(ctx, 'FAIL: ' + test.name, { configClass: configClass, error: error })
      }

      results.push({ name: test.name, passed: passed, error: error })
    })

    // ── Teardown ─────────────────────────────────────────────────────────────
    try { document.body.removeChild(scratch) } catch (_) {}
    globalThis.dudezilla = savedDudezilla

    var passed = results.filter(function (r) { return r.passed }).length
    Logger.message(ctx, 'Test run complete', {
      configClass: configClass,
      passed:      passed,
      total:       results.length,
    })

    this._renderResults(meta.controlType || configClass, results)
  }

  // ── DOM rendering ──────────────────────────────────────────────────────────

  _renderError (msg) {
    var p       = document.createElement('p')
    p.className = 'th-error'
    p.textContent = '\u26a0 ' + msg
    this.element.appendChild(p)
  }

  _renderEmpty (controlType) {
    var p       = document.createElement('p')
    p.className = 'th-empty'
    p.textContent = 'No tests defined for ' + (controlType || 'this control') + '.'
    this.element.appendChild(p)
  }

  _renderResults (controlType, results) {
    var passed    = results.filter(function (r) { return r.passed }).length
    var total     = results.length
    var allPassed = passed === total
    var wrapper   = this.element
    var state     = allPassed ? 'pass' : 'fail'

    // ── Summary bar ──────────────────────────────────────────────────────────
    var summary       = document.createElement('div')
    summary.className = 'th-summary ' + state

    var badge       = document.createElement('span')
    badge.className = 'th-badge ' + state
    badge.textContent = allPassed ? 'ALL PASS' : 'FAILING'

    var tally       = document.createElement('span')
    tally.className = 'th-tally'
    tally.textContent = passed + ' / ' + total + ' tests passed \u2014 ' + controlType

    summary.appendChild(badge)
    summary.appendChild(tally)
    wrapper.appendChild(summary)

    // ── Result rows ───────────────────────────────────────────────────────────
    var list       = document.createElement('div')
    list.className = 'th-list'

    results.forEach(function (r) {
      var row       = document.createElement('div')
      row.className = 'th-row'

      var status       = document.createElement('span')
      status.className = 'th-status ' + (r.passed ? 'pass' : 'fail')
      status.textContent = r.passed ? 'PASS' : 'FAIL'

      var detail = document.createElement('div')

      var nameEl       = document.createElement('span')
      nameEl.className = 'th-name'
      nameEl.textContent = r.name
      detail.appendChild(nameEl)

      if (r.error) {
        var errEl       = document.createElement('div')
        errEl.className = 'th-err'
        errEl.textContent = r.error
        detail.appendChild(errEl)
      }

      row.appendChild(status)
      row.appendChild(detail)
      list.appendChild(row)
    })

    wrapper.appendChild(list)

    this.setValue(passed + '/' + total)
  }
}

TestHarnessControl.controlType = 'test_harness'

TestHarnessControl.meta = {
  controlType:   'test_harness',
  category:      'debug',
  description:   'Instantiates a target control using its .meta.defaultConfig, runs every .meta.test fn against it, and renders a PASS/FAIL result table. Pass targetClass (constructor) in config.',
  defaultConfig: null,
  tests:         [],
}

export { TestHarnessControl }
