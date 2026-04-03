import { Control } from '../ControlCollection.js'

class ValueDisplayControl extends Control {
/*
    let config = {
        name: "name_of_el",
        label: "el's value is:",
        state:"UNDEFINED",
        control_type:"value_display"
    }
*/

/**
 * @param {ControlCollection.ControlConfig} controlConfig - A configuration object.
 */
  constructor (controlConfig) {
    super(controlConfig)
    this.element = this.makeElement()
  }

  makeElement () {
    const el = document.createElement('label')
    el.id = this.getID()
    el.innerHTML = this.buildString()
    return el
  }

  buildString () {
    this.appendHTML (this.getLabel() + ' ' + this.getValue())
    return this.getHTML ()
  }

  // push the display value to the view.
  updateView () {
    const el = this.getElement()
    el.innerHTML = this.getLabel() + ' ' + this.getValue()
  }
}

ValueDisplayControl.controlType = 'value_display'

ValueDisplayControl.meta = {
  controlType:   'value_display',
  category:      'display',
  description:   'A read-only label that renders "label + value". Calls updateView() to push a new value to the DOM without rebuilding.',
  defaultConfig: { name: 'test_vd', label: 'Status:', state: 'ready', control_type: 'value_display' },
  tests: [
    {
      name: 'getValue returns initial value',
      fn: function (ctrl) { return ctrl.getValue() === 'ready' }
    },
    {
      name: 'setValue / getValue roundtrip',
      fn: function (ctrl) { ctrl.setValue('done'); return ctrl.getValue() === 'done' }
    },
    {
      name: 'buildSubControls returns a DOM element',
      fn: function (ctrl) { var el = ctrl.getElement(); return !!el && el.nodeType === 1 }
    },
    {
      name: 'DOM element is a label',
      fn: function (ctrl) { return ctrl.getElement().tagName === 'LABEL' }
    },
    {
      name: 'DOM shows initial value text',
      fn: function (ctrl) { return ctrl.getElement().textContent.toLowerCase().includes('ready') }
    },
    {
      name: 'updateView reflects new value in DOM',
      fn: function (ctrl) {
        ctrl.buildSubControls()
        ctrl.setValue('updated')
        ctrl.updateView()
        return ctrl.getElement().innerHTML.includes('updated')
      }
    },
    {
      name: 'getLabel returns configured label',
      fn: function (ctrl) { return ctrl.getLabel() === 'Status:' }
    },
  ]
}

export { ValueDisplayControl }
