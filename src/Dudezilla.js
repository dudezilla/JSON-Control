const ControlCollection = require('./ControlCollection.js')
const ControlBindings = ControlCollection.ControlBindings
module.exports.ControlBindings = ControlBindings

const Control = ControlCollection.Control
module.exports.Control = Control

const ControlConfiguration = ControlCollection.ControlConfiguration
module.exports.ControlConfiguration = ControlConfiguration

const TestControlClass = require('./TestControl.js')
const TestControl = TestControlClass.TestControl
module.exports.TestControl = TestControl

const ValueDisplayControlClass = require('./ValueDisplayControl.js')
const ValueDisplayControl = ValueDisplayControlClass.ValueDisplayControl
module.exports.ValueDisplayControl = ValueDisplayControl

const BooleanControlClass = require('./BooleanControl.js')
const BooleanControl = BooleanControlClass.BooleanControl
module.exports.BooleanControl = BooleanControl

const VerboseBooleanControlClass = require('./VerboseBooleanControl.js')
const VerboseBooleanControl = VerboseBooleanControlClass.VerboseBooleanControl
module.exports.VerboseBooleanControl = VerboseBooleanControl

const SelectionControlClass = require('./SelectionControl.js')
const SelectionControl = SelectionControlClass.SelectionControl
module.exports.SelectionControl = SelectionControl