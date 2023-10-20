const ControlCollection = require('./ControlCollection.js')
const ControlBindings = ControlCollection.ControlBindings
const ControlConfiguration = ControlCollection.ControlConfiguration
const Control = ControlCollection.Control
const RadioControl = require('./RadioControl.js').RadioControl

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
      current: this.getValue() === this.selectValue(i),
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
module.exports.SelectionControl = SelectionControl
