import { ControlRegistry, ControlConfiguration } from './ControlCollection.js'
import * as controls from './controls/index.js'

// ── Dynamic control registry ──────────────────────────────────────────────────
// Each control class exported from src/controls/index.js must carry a static
// controlType property (e.g. BooleanControl.controlType = 'boolean').
// Built lazily on first call to getTypeMap() so that circular imports
// (e.g. TestHarnessControl → ControlFactory → controls/index.js) do not cause
// a temporal dead zone ReferenceError at module evaluation time.

var _typeMap = null
function getTypeMap () {
  if (!_typeMap) {
    _typeMap = Object.fromEntries(
      Object.values(controls)
        .filter(function (v) { return typeof v === 'function' && typeof v.controlType === 'string' })
        .map(function (Ctrl) { return [Ctrl.controlType, Ctrl] })
    )
  }
  return _typeMap
}

/**
 * @classdesc ControlFactory
 *
 * Accepts an array of Config objects and a rootID, then constructs and mounts
 * the corresponding Control instances in order.
 *
 * Usage:
 *
 *   const factory = new ControlFactory([
 *     { name: 'flag',    label: 'Enable',  state: false,  control_type: 'boolean'      },
 *     { name: 'snippet', label: 'Example', state: 'x=1;', control_type: 'code_snippet' },
 *   ], 'root')
 *
 *   factory.build().mount(document.getElementById('root'))
 *
 * To add a new control type: create a new *Control.js in src/controls/ with a
 * static controlType property, then add its export to src/controls/index.js.
 *
 * @param {Array<Config>} configs - Ordered array of Config objects.
 * @param {string}        rootID  - The HTML id of the mounting element.
 */
class ControlFactory {
  constructor (configs, rootID) {
    this.configs  = configs
    this.rootID   = rootID
    this.controls = []
  }

  /**
   * Instantiates every control in configs order.  Each root-level Control
   * auto-registers into ControlRegistry.instance on construction — no manual
   * append is required.
   *
   * @returns {ControlFactory} this — for chaining with .mount()
   * @throws {Error} if a config's control_type is not registered
   */
  build () {
    const self = this
    this.configs.forEach(function (config) {
      const ControlClass = getTypeMap()[config.control_type]
      if (!ControlClass) {
        throw new Error(
          'ControlFactory.build: unknown control_type "' + config.control_type +
          '". Registered types: ' + Object.keys(getTypeMap()).join(', ')
        )
      }
      const cfg = new ControlConfiguration(config)
      cfg.setRootID(self.rootID)
      // Construction auto-registers the control in ControlRegistry.instance.
      const ctrl = new ControlClass(cfg)
      self.controls.push(ctrl)
    })
    return this
  }

  /**
   * Appends each control's DOM subtree to rootEl and attaches event handlers.
   *
   * @param {Element} rootEl - The DOM element to mount into.
   * @returns {ControlFactory} this
   */
  mount (rootEl) {
    this.controls.forEach(function (ctrl) {
      rootEl.appendChild(ctrl.buildSubControls())
      ctrl.applyHandlers()
    })
    return this
  }

  getBindings () { return ControlRegistry.instance }
  getControls ()  { return this.controls }
  getControl (name) { return this.controls.find(function (c) { return c.getName() === name }) }

  static getTypeMap () { return getTypeMap() }
}

export { ControlFactory }
