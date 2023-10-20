const ControlCollection = require('./ControlCollection.js')
const ControlBindings = ControlCollection.ControlBindings
const ControlConfiguration = ControlCollection.ControlConfiguration
const Control = ControlCollection.Control

class BooleanControl extends Control {
  //    config = {
  //    name:"still_stats",
  //    current:false,
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
  const control = global.dudezilla.bindings.fetchGlobal(this.id)
  control.setValue(this.checked)
  control.eventLinkage(this.checked)
}

module.exports.BooleanControl = BooleanControl
