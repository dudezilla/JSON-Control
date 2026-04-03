import { Control, ControlConfiguration } from '../ControlCollection.js'
import { ControlFactory } from '../ControlFactory.js'

/**
 * @classdesc CompositeControl — a container that instantiates X child controls
 * from a `children` config array and arranges them in a layout template.
 *
 * Layout options (config.layout):
 *   'stack'   — flex column, one child per row (default)
 *   'row'     — flex row, children flow left-to-right, wrapping
 *   'grid-2'  — two-column CSS grid
 *   'grid-3'  — three-column CSS grid
 *
 * getValue() returns a plain-object snapshot  { childName: childValue, ... }
 * which is JSON-serialisable and suitable for display in ValueDisplayControl.
 *
 * setValue(obj) accepts a plain object or Map of { name → value } and
 * distributes matching values to child controls.
 *
 * getChild(name) retrieves a child control by its config.name.
 *
 * Example config:
 * {
 *   name:         'settings',
 *   label:        'Settings Panel',
 *   state:      {},
 *   control_type: 'composite',
 *   layout:       'grid-2',
 *   children: [
 *     { name: 'enabled', label: 'Enabled',  state: false,    control_type: 'boolean'   },
 *     { name: 'verbose', label: 'Verbose',  state: false,    control_type: 'boolean'   },
 *     { name: 'mode',    label: 'Mode',     state: 'normal', control_type: 'selection',
 *       options: ['normal', 'turbo', 'safe'] }
 *   ]
 * }
 */
class CompositeControl extends Control {
  /**
   * @param {ControlConfiguration} controlConfig
   */
  constructor (controlConfig) {
    super(controlConfig)
    this._buildChildren()
    this.element = this._makeContainerElement()
  }

  /**
   * Instantiate every child config via ControlFactory.getTypeMap() and
   * register each child in this.subControls.
   * @private
   */
  _buildChildren () {
    const typeMap     = ControlFactory.getTypeMap()
    const childConfs  = this.config.children || []
    for (const childConfig of childConfs) {
      const ChildClass = typeMap[childConfig.control_type]
      if (!ChildClass) {
        throw new Error(
          'CompositeControl: unknown child control_type "' + childConfig.control_type +
          '". Registered: ' + Object.keys(typeMap).join(', ')
        )
      }
      const cfg = new ControlConfiguration(childConfig)
      cfg.setParent(this)
      const ctrl = new ChildClass(cfg)
      this.appendChild(ctrl)
    }
  }

  /**
   * Build the wrapper element.  Children are NOT appended here — the base
   * class buildSubControls() iterates this.subControls and appends them,
   * so they appear below the label heading in DOM order.
   * @private
   * @returns {HTMLElement}
   */
  _makeContainerElement () {
    const layout  = this.config.layout || 'stack'
    const wrapper = document.createElement('div')
    wrapper.id        = this.getID()
    wrapper.className = 'cc-composite cc-layout-' + layout

    if (this.getLabel()) {
      const lbl = document.createElement('h4')
      lbl.className   = 'cc-composite-label'
      lbl.textContent = this.getLabel()
      wrapper.appendChild(lbl)
    }

    return wrapper
  }

  /**
   * Returns a plain-object snapshot of all children's current values.
   * Keys are each child's config.name.  The result is JSON-serialisable.
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
   * Distribute values to child controls.
   * @param {Object|Map} values - A plain object or Map of { childName → value }.
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
   * Retrieve a direct child control by its config.name.
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
   * Called when a child fires eventLinkage.
   * Propagates upward if this composite is itself a child of another control.
   * @param {*} stateChange
   */
  onChildEvent (stateChange) {
    if (this.isChild()) {
      this.eventLinkage(stateChange)
    }
  }
}

CompositeControl.controlType = 'composite'

CompositeControl.meta = {
  controlType:   'composite',
  category:      'composite',
  description:   'Container that instantiates X child controls from a children[] config array and arranges them in a layout template (stack | row | grid-2 | grid-3). getValue() returns a plain-object snapshot of all child values.',
  defaultConfig: {
    name:         'test_composite',
    label:        'Settings Panel',
    state:      {},
    control_type: 'composite',
    layout:       'stack',
    children: [
      { name: 'enabled', label: 'Enabled', state: false, control_type: 'boolean' },
      { name: 'verbose', label: 'Verbose', state: false, control_type: 'boolean' },
    ]
  },
  tests: [
    {
      name: 'has two child controls',
      fn: function (ctrl) { return ctrl.subControls.size === 2 }
    },
    {
      name: 'getValue returns a plain object with child names as keys',
      fn: function (ctrl) {
        var v = ctrl.getValue()
        return typeof v === 'object' && v !== null && 'enabled' in v && 'verbose' in v
      }
    },
    {
      name: 'getChild(name) returns the named child control',
      fn: function (ctrl) {
        var child = ctrl.getChild('enabled')
        return child !== undefined && child.getName() === 'enabled'
      }
    },
    {
      name: 'getValue child values match initial config',
      fn: function (ctrl) {
        var v = ctrl.getValue()
        return v.enabled === false && v.verbose === false
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
      name: 'DOM contains a label heading',
      fn: function (ctrl) {
        var h4 = ctrl.getElement().querySelector('h4.cc-composite-label')
        return h4 !== null && h4.textContent === 'Settings Panel'
      }
    },
    {
      name: 'DOM contains child control elements',
      fn: function (ctrl) {
        return ctrl.getElement().children.length >= 2
      }
    },
    {
      name: 'for...of iterates all children',
      fn: function (ctrl) {
        var names = []
        for (var child of ctrl.subControls) { names.push(child.getName()) }
        return names.length === 2 && names[0] === 'enabled' && names[1] === 'verbose'
      }
    },
  ]
}

export { CompositeControl }
