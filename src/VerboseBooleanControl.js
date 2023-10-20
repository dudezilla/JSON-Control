const ControlCollection = require('./ControlCollection.js')
const ControlBindings = ControlCollection.ControlBindings
const ControlConfiguration = ControlCollection.ControlConfiguration
const Control = ControlCollection.Control
const BooleanControl = require('./BooleanControl').BooleanControl

class VerboseBooleanControl extends Control {
  //    config = {
  //    name:"still_stats",
  //    current:false,
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

module.exports.VerboseBooleanControl = VerboseBooleanControl
