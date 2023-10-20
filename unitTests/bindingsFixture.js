const ControlCollection = require('../src/ControlCollection.js')
const ControlBindings = ControlCollection.ControlBindings
const Control = ControlCollection.Control
const ControlConfiguration = ControlCollection.ControlConfiguration

class BindingsFixture {
  /**
  * @property {function} - makeConfig - {@link BindingsFixture#makeConfig} Create a configuration object.
  * @returns {Control.Config} - A configuration object. 
  */
  makeConfig (name, label, current, controlType) {
    return { name, label, current, control_type: controlType }
  }

  /**
   * @property {function} - makeConficControl - {@link BindingsFixture#makeConficControl} Create a configuration object.
   * @returns {ControlCollection.ControlConfiguration} - A complete configuration object.
   */
  makeConficControl (name, label, value, controlType) {
    const con = this.makeConfig(name, label, value, controlType)
    const conConf = new ControlConfiguration(con)
    conConf.setRootID('root')
    return conConf
  }

  /**
  * @property {function} - makeTopLevel - {@link BindingsFixture#makeTopLevel} Create a top-level control. "a0" under "root" resulting in a procedural ID of "root__a0".
  * @returns {void} - Nothing.
  */
  makeTopLevel () {
    const control = new Control(this.makeConficControl('a0', 'labal-a0', 'value=xxx', 'test_control'))
    global.dudezilla.bindings.append(control)
  }

  /**
  * @property {function} - makeChild - {@link BindingsFixture#makeChild} This fixture continues the work of make_top_level by adding a child to "root__a0" in the first row. The child begins as 'b0' and is assigned "root__a0__b0" as its procedural ID.  
  * @returns {void} - Nothing.
  */
  makeChild () {
    const bindings = global.dudezilla.bindings
    const rootA0 = bindings.fetch('root__a0')
    const childConfig = this.makeConfig('b0', 'depth one.', 'value=xxx', 'test_control')
    const conCon = new ControlConfiguration(childConfig)
    conCon.setParent(rootA0)
    const child = new Control(conCon)
    rootA0.appendChild(child)
  }

  /**
  * @property {function}  - makeChildren -{@link BindingsFixture#makeChildren} Adds "c0" to "root__a0__c0"
  * @returns {void} - Nothing.
  * @todo - The name makeChildren implies that there is more than one child.
  */
  makeChildren () {
    const bindings = global.dudezilla.bindings
    const miniRoot = bindings.fetch('root__a0__b0')
    const childConfig = this.makeConfig('c0', 'depth two', 'value=xxx', 'test_control')
    const conConf = new ControlConfiguration(childConfig)
    conConf.setParent(miniRoot)
    miniRoot.appendChild(new Control(conConf))
  }
}

module.exports.BindingsFixture = BindingsFixture
