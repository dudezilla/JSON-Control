const ControlCollection = require('./ControlCollection.js')
const Control = ControlCollection.Control

class ValueDisplayControl extends Control {
/*
    let config = {
        name: "name_of_el",
        label: "el's value is:",
        current:"UNDEFINED",
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

module.exports.ValueDisplayControl = ValueDisplayControl
