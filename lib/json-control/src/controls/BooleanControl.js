import { Control, ControlRegistry, ControlConfiguration } from '../ControlCollection.js'
class BooleanControl extends Control {
  //    config = {
  //    name:"still_stats",
  //    state:false,
  //    control_type: "boolean"
  //    };
  constructor (controlConfiguration) {
    super(controlConfiguration)
    this.element = this.makeElement()
    this.appendHandler({
      id: this.getID(),
      type: 'click',
      func: booleanHandler
    })
  }

  makeElement () {
    const el = document.createElement('div')
    el.innerHTML = this.buildString()
    return el
  }

  buildString () {
    let checked = ''
    if (this.getValue()) {
      checked = 'checked'
    }
    this.appendHTML('<label>')
    this.appendHTML(`<input type='checkbox' id='${this.getID()}' `)
    this.appendHTML(`${checked}>`)
    this.appendHTML(`${this.getLabel()}</label>`)
    return this.getHTML()
  }
}

function booleanHandler () {
  const control = globalThis.dudezilla.bindings.fetchGlobal(this.id)
  control.setValue(this.checked)
  control.eventLinkage(this.checked)
}

BooleanControl.controlType = 'boolean'

BooleanControl.meta = {
  controlType:   'boolean',
  category:      'input',
  description:   'A checkbox that toggles a true/false value and fires eventLinkage on click.',
  defaultConfig: { name: 'test_bool', label: 'Enable', state: false, control_type: 'boolean' },
  tests: [
    {
      name: 'getValue returns initial false',
      fn: function (ctrl) { return ctrl.getValue() === false }
    },
    {
      name: 'setValue / getValue roundtrip (true)',
      fn: function (ctrl) { ctrl.setValue(true); return ctrl.getValue() === true }
    },
    {
      name: 'setValue / getValue roundtrip (false)',
      fn: function (ctrl) { ctrl.setValue(false); return ctrl.getValue() === false }
    },
    {
      name: 'buildSubControls returns a DOM element',
      fn: function (ctrl) { var el = ctrl.getElement(); return !!el && el.nodeType === 1 }
    },
    {
      name: 'DOM contains a checkbox input',
      fn: function (ctrl) { return ctrl.getElement().querySelector('input[type=checkbox]') !== null }
    },
    {
      name: 'getLabel returns configured label',
      fn: function (ctrl) { return ctrl.getLabel() === 'Enable' }
    },
  ]
}

export { BooleanControl }
