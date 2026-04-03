import { Control, ControlRegistry, ControlConfiguration } from '../ControlCollection.js'
import { BooleanControl } from './BooleanControl.js'

class VerboseBooleanControl extends Control {
  //    config = {
  //    name:"still_stats",
  //    state:false,
  //    control_type: "boolean"
  //    };
  constructor (controlConfiguration) {
    super(controlConfiguration)
    this.makeSubs()
    this.element = this.makeElement()
  }

  makeElement () {
    const el = document.createElement('div')
    el.innerHTML = `<label id=${this.getID()}>${this.getValue()}</label>`
    return el
  }

  makeSubs () {
    const controlConfig = new ControlConfiguration(this.config)
    controlConfig.setParent(this)
    this.appendChild(new BooleanControl(controlConfig))
  }

  replaceLabel (value) {
    const el = document.getElementById(this.getID())
    el.innerHTML = value
  }


  /**
  * @property {function} - onChildEvent - {@link Control#onChildEvent} When the boolean value changes, this method is called.
  * @param {object} - state_change
  * @abstract - override this method and interpret the state change.
  */
  onChildEvent (state_change) {
    this.replaceLabel(state_change)
  }
}

VerboseBooleanControl.controlType = 'verbose_boolean'

VerboseBooleanControl.meta = {
  controlType:   'verbose_boolean',
  category:      'composite',
  description:   'A BooleanControl child paired with a label that displays the current true/false value as text.',
  defaultConfig: { name: 'test_vbool', label: 'Verbose flag', state: false, control_type: 'verbose_boolean' },
  tests: [
    {
      name: 'getValue returns initial false',
      fn: function (ctrl) { return ctrl.getValue() === false }
    },
    {
      name: 'setValue / getValue roundtrip',
      fn: function (ctrl) { ctrl.setValue(true); return ctrl.getValue() === true }
    },
    {
      name: 'buildSubControls returns a DOM element',
      fn: function (ctrl) { var el = ctrl.getElement(); return !!el && el.nodeType === 1 }
    },
    {
      name: 'has a BooleanControl sub-control',
      fn: function (ctrl) { return ctrl.subControls.getKeys().length > 0 }
    },
    {
      name: 'DOM contains a checkbox input',
      fn: function (ctrl) { return ctrl.getElement().querySelector('input[type=checkbox]') !== null }
    },
    {
      name: 'onChildEvent updates label element text',
      fn: function (ctrl) {
        ctrl.buildSubControls()
        ctrl.onChildEvent('yes')
        var el = document.getElementById(ctrl.getID())
        return el !== null && el.innerHTML === 'yes'
      }
    },
  ]
}

export { VerboseBooleanControl }
