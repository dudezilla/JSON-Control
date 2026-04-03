import { Control, ControlRegistry, ControlConfiguration } from '../ControlCollection.js'
import { RadioControl } from './RadioControl.js'

class SelectionControl extends Control {
  constructor (controlConfiguration) {
    super(controlConfiguration)
    this.selection = controlConfiguration.getConfig().values
    this.makeRadios()
    // this.buildSubControls() //inherited from Control
    this.element = this.makeElement()
  }

  makeElement () {
    const el = document.createElement('div')
    el.id = this.getID()
    el.innerText = this.getLabel()
    // this.buildSubControls()
    return el
  }

  makeRadios () {
    for (let i = 0; i < this.selection.length; i++) {
      this.makeRadio(i)
    }
  }

  makeRadio (i) {
    const config = {
      name: this.selectValue(i),
      label: this.selectValue(i),
      state: this.getValue() === this.selectValue(i),
      control_type: 'radio',
      setName: this.getName()
    }
    const controlConfig = new ControlConfiguration(config)
    controlConfig.setParent(this)
    const radio = new RadioControl(controlConfig)
    this.appendChild(radio)
  }

  /* WAS THIS RENAMED? YES! WAS onChildListenEvent */
  onChildEvent (stateChange) {
    this.setValue(stateChange)
  }

  selectValue (value) {
    return this.getSelection()[value]
  }

  getSelection () {
    return this.selection
  }
}
SelectionControl.controlType = 'selection'

SelectionControl.meta = {
  controlType:   'selection',
  category:      'selection',
  description:   'A group of RadioControl children representing mutually exclusive options. Value is the currently selected option string.',
  defaultConfig: { name: 'test_sel', label: 'Pick one', state: 'B', control_type: 'selection', values: ['A', 'B', 'C'] },
  tests: [
    {
      name: 'getValue returns initial selection',
      fn: function (ctrl) { return ctrl.getValue() === 'B' }
    },
    {
      name: 'setValue / getValue roundtrip',
      fn: function (ctrl) { ctrl.setValue('A'); return ctrl.getValue() === 'A' }
    },
    {
      name: 'creates one RadioControl child per option',
      fn: function (ctrl) { return ctrl.subControls.getKeys().length === 3 }
    },
    {
      name: 'selectValue returns correct option by index',
      fn: function (ctrl) { return ctrl.selectValue(0) === 'A' && ctrl.selectValue(2) === 'C' }
    },
    {
      name: 'onChildEvent updates the value',
      fn: function (ctrl) { ctrl.onChildEvent('C'); return ctrl.getValue() === 'C' }
    },
    {
      name: 'buildSubControls returns a DOM element',
      fn: function (ctrl) { var el = ctrl.getElement(); return !!el && el.nodeType === 1 }
    },
    {
      name: 'DOM contains 3+ radio inputs',
      fn: function (ctrl) { return ctrl.getElement().querySelectorAll('input[type=radio]').length >= 3 }
    },
  ]
}

export { SelectionControl }
