/**
* @classdesc - An abstract class for all controls.
* @property {function} - constructor
* @property {object} - config - The configuration object.
* @property {string} - rootID - HTML ID Attribute of the Root Tag.
* @property {Control} - parent - A collection of child controls.
* @property {Array<String>} - htmlBuffer - A buffer for constructing the "innerHTML".
* @property {ControlBindings} - subControls - The child elements.
* @property {Array<HandlerSerialization>} - handlers - An array of event handlers for this control.
* @property {function} - getElement - {@link Control#getElement} Fetch the DOM Element representation of this control. @todo - fetch_element() renamed to getElement()
* @property {function} - buildSubControls - {@link Control#buildSubControls} Populate the DOM element with the child elements.
* @property {function} - applyHandlers - {@link Control#applyHandlers} Deserialize the event handlers (see - {@link HandlerSerialization}) and apply them to the DOM elements, then call applySubControlHandlers.
* @property {function} - applySubControlHandlers - {@link Control#applySubControlHandlers} Every Control in the ControlBindings Object potentially has an event handler.
* @property {function} - appendHandler - {@link Control#appendHandler} Push a HandlerSerialization Object on the stack Called before the DOM is populated, during the build phase.
* @property {function} - appendChild -{@link Control#appendChild} Append a child control to this control. Call during the build phase
* @property {function} - appendHTML - {@link Control#appendHTML} Append a string of HTML to the html_buffer
* @property {function} - getHTML  - {@link Control#getHTML} Serialize the HTML buffer of config into a string.
* @property {function} - getParent - {@link Control#getParent} Get a Pointer to the Parent Control.
* @property {function} - isChild - {@link Control#isChild} "isChild" tests if this object is a child of another control.
* @property {function} - getConfig - {@link Control#getConfig} Get the configuration object.
* @property {function} - getName - {@link Control#getName} Get the name of the control.
* @property {function} - getLabel - {@link Control#getLabel} Get the label of the control.
* @property {function} - getID - {@link Control#getID} Obtain a procedurally generated ID assigned to the control. For example: "root__control__controlDepth1__controlDepth2__controlDepth3"
* @property {function} - setValue - {@link Control#setValue} Set the value of the control.
* @property {function} - getValue - {@link Control#getValue} Get the value of the control.
* @property {function} - eventLinkage - {@link Control#eventLinkage} EventLinkage is called outside of the object from the event handler.
* @property {function} - onChildEvent - {@link Control#onChildEvent} How will the control respond to the event? Override this method and interpret the state change.
* @property {function} - getRoot - {@link Control#getRoot} Get the top-most control in the hierarchy.
* @property {function} - toString - {@link Control#toString} Produce and return a formatted string containing the id, name, and label.
* @property {function} - getJSON - {@link Control#getJSON} Converts the control into a JSON string.
*/

class Control {
  /**
  * @property {function}
  * @param {ControlConfig} controlConfig - {@link ControlConfig} - A configuration object.
  * @throws Error - Throws an error if the configuration object is invalid.
  */
  constructor (controlConfig) {
    if (!controlConfig.isValid()) {
      throw new Error('Control:constructor - Invalid Configuration')
    }

    /**
    * @property {object} - config - The configuration object.
    */
    this.config = controlConfig.config

    /**
    * @property {string} - rootID - HTML ID Attribute of the Root Tag.
    */
    this.rootID = controlConfig.getRootID()

    /**
    * @property {Control} - parent - A collection of child controls.
    */
    this.parent = controlConfig.parent

    /**
    * @property {Array<String>} - htmlBuffer - A buffer for constructing the "innerHTML".
    */
    this.htmlBuffer = []

    /**
    * @property {ControlBindings} - subControls - The child elements.
    */

    this.subControls = new ControlBindings()

    /**
    * @property {Array<HandlerSerialization>} - handlers - An array of event handlers for this control.
    */
    this.handlers = []
  }

  /**
  * @property {function} - getElement - {@link Control#getElement} Fetch the DOM Element representation of this control. @todo - fetch_element() renamed to getElement().
  * @returns {Object} - A DOM Element
  */
  getElement () {
    return this.element
  }

  /**
  * @property {function} - buildSubControls - {@link Control#buildSubControls} Populate the DOM element with the child elements.
  * @returns {Object} - A DOM Element containing the child elements.
  */
  buildSubControls () {
    let childID = this.subControls.getKeys()
    let subAnchor = this.getElement()
    for (let i = 0; i < childID.length; i++) {
      subAnchor.appendChild(this.subControls.fetch(childID[i]).buildSubControls())
    }
    return subAnchor
  }

  /**
  * @property {function} - applyHandlers - {@link Control#applyHandlers} Deserialize the event handlers (see - {@link HandlerSerialization}) and apply them to the DOM elements, then call applySubControlHandlers.
  * @returns {void}
  * @todo - found a bug where the handler is applied to the "HTML element of this". - This is not the desired behavior.
  *
  */
  applyHandlers () {
    let el = null
    let handler = null
    let handlers = this.handlers
    for (let i = 0; i < handlers.length; i++) {
      handler = handlers[i]

      el = document.getElementById(handler.id)
      el.addEventListener(handler.type, handler.func)
    }
    this.applySubControlHandlers()
  }

  /**
  * @property {function}  - applySubControlHandlers - {@link Control#applySubControlHandlers} Every Control in the ControlBindings Object potentially has an event handler.
  * @returns {void}
  */
  applySubControlHandlers () {
    let subControls = this.subControls
    let keys = subControls.getKeys()
    for (let i = 0; i < keys.length; i++) {
      let selected = subControls.fetch(keys[i])
      selected.applyHandlers()
    }
  }

  /**
  * @property {function}  - appendHandler - {@link Control#appendHandler} Push a HandlerSerialization Object on the stack Called before the DOM is populated, during the build phase.
  * @param {HandlerSerialization} - A HandlerSerialization object. {@link HandlerSerialization}
  * @returns {void}
  */
  appendHandler (handler) {
    this.handlers.push(handler)
  }

  /**
  * @property {function} appendChild -{@link Control#appendChild} Append a child control to this control. Call during
  * @returns {void}
  */
  appendChild (control) {
    this.subControls.append(control)
  }

  /**
  * @property {function}  - appendHTML - {@link Control#appendHTML} Append a string of HTML to the html_buffer
  * @param {string} - value - A string of HTML.
  * @returns {void}
  */
  appendHTML (value) {
    this.htmlBuffer.push(value)
  }

  /**
  * @property {function}  - getHTML  - {@link Control#getHTML} Serialize the HTML buffer of config into a string.
  * @returns {string} - The HTML string rep.
  **/
  getHTML () {
    let result = ''
    let els = this.htmlBuffer.length
    for (let i = 0; i < els; i++) {
      result += this.htmlBuffer[i]
    }
    return result
  }

  /**
  * @property {function} - getParent - {@link Control#getParent} Get a Pointer to the Parent Control.
  * @returns {Control} - the parent control
  */
  getParent () {
    if (!this.isChild()) {
      throw new Error('Control:getParent - Is not a child!')
    }
    return this.parent
  }

  /**
  * @property {function} - {@link Control#isChild} "isChild" tests if this object is a child of another control.
  * @returns {boolean}
  */
  isChild () {
    return (this.parent !== undefined)
  }

  /**
  * @property {function} - getConfig - {@link Control#getConfig} Get the configuration object.
  * @returns {object} - The configuration object
  */
  getConfig () {
    return this.config
  }

  /**
    * @property {function} - getName - {@link Control#getName} Get the name of the control.
    * @returns {string} - The name of the control.
    */
  getName () {
    return this.config.name
  }

  /**
    * @property {function} - getLabel - {@link Control#getLabel} Get the label of the control.
    * @returns {string} - The label of the control.
    */
  getLabel () {
    return this.config.label
  }

  /**
   * @property {function} - getID - {@link Control#getID} Obtain a procedurally generated ID assigned to the control. For example: "root__control__controlDepth1__controlDepth2__controlDepth3"
   * @returns {string} - The id for the root of this element.
   *
   */
  getID () {
    let result = ''
    if (this.isChild()) {
      // console.log("is a child - name:",this.config.name);
      result += this.parent.getID()
    } else {
      result += this.rootID
    }
    return `${result}__${this.getName()}`
  }

  /**
  * @property {function} - {@link Control#setValue} Set the value of the control.
  * @param {string} - value - a value that the control will assume.
  */
  setValue (value) {
    this.getConfig().current = value
  }

  /**
   * @property {function}  - {@link Control#getValue} Get the value of the control.
   * @returns {string} - the value of the control.
   */
  getValue () {
    return this.config.current
  }

  // /**

  //       event_linkage is for the child to contact
  //       the parrent.

  //       it passes a message - or state_change,
  //       * which is an arbritrary variable interpreted by
  //       -- the parrent in a composite control.

  //       Example may be an event listener.
  //       perhaps a 'click' listener bound to a 'check_box'

  //       So in the listener for 'check_box'
  //       assume that the Control object from the global mappings
  //       has already been dereferenced, to control.

  //       So:
  //          control.event_linkage({
  //               "id":"id-of-checkbox",
  //               "value": document.getElementById('id-of-checkbox').checked
  //          });

  //       event_linkage routes the object passed as a variable to the parrent
  //       class. This necessitates that a parrent class should have some
  //       'process' to act on that data.

  //       Which is why you placed that 'process' in a function named:
  //       'on_child_listen_event(takes_an_arg)' located in the class that extends
  //       the base Control. - Which contains a reference to the 'child'
  //       method mentioned above in it's ControlBindings instance,

  //              on_child_listen_event(state_change) - interprets the state change.
  //                   console.log(state_change);
  //               {
  //                   "id":"id-of-checkbox",
  //                   "value": document.getElementById('id-of-checkbox').checked
  //               }

  //   */

  /**
   * Called during runtime after construction -
   * eventLinkage can be called during an "Event"
   * This is an entry point for the event handler.
   * This method is used to pass a message from a child control's
   * event-hanlder to the parent control.
   *
   * The nature of the message is arbitrary and is interpreted by the
   * parent control.
   *
   * Example:
   * A slider control / text combo control
   *
   * modify the "value of the control" and modify the
   *
   * @property {function} - eventLinkage - {@link Control#eventLinkage} EventLinkage is called outside of the object
   * @param {object} state_change - @todo verify this is an event object
   *
   */
  eventLinkage (state_change) {
    if (this.isChild()) {
      this.parent.onChildEvent(state_change)
    }
  }

  /**
  * @todo - naming convention - some research on naming event_listeners.}
  * @property {function} - onChildEvent - {@link Control#onChildEvent} How will the control respond to the event?
  * @param {object} - state_change - @todo verify this is an event object
  * @abstract - override this method and interpret the state change.
  */
  onChildEvent (state_change) {
    throw new Error('EVENT HANDLER - onChildEvent() - abstract called')
  }

  /**
  * @property {function} - getRoot - {@link Control#getRoot} Get the top-most control in the hierarchy.
  * @returns {Control}  - The top-most Control object in the hierarchy where "this" resides.
  */
  getRoot () {
    let result = this
    while (result.isChild()) {
      result = result.parent
    }
    return result
  }

  /**
   * @property {function} - toString - {@link Control#toString} Produce and return a formatted string containing the id, name, and label.
     * @returns {string} - A formatted string containing the id, name, label, and style properties.
     */
  toString () {
    let value = 'Control:\t' + this.getID()
    value += '\n\tname:\t' + this.getName()
    value += '\n\tlabel:\t' + this.getLabel()
    return value
  }

  /**
  * @property {function} - toString - {@link Control#toString} Produce and return a formatted string containing the id, name, and label.
  * @todo - Config needs a type definition.
  * @returns {string} - A JSON String representing the control.
  */
  getJSON () {
    let result = `id:${this.getID()}\n`
    result += `config = ${this.config}\n`
    let keys = this.subControls.getKeys()

    for (let i = 0; i < keys.length; i++) {
      result += this.subControls.fetch(keys[i]).getJSON()
    }
    return result
  }
}

/**
* @todo - make a formal class.
* @classdesc HandlerSerialization - Wraps the three properties that describe an event handler. The ID of the control, the type of event, and the callback function are required to install the event.
* @typedef {Object} HandlerSerialization
* @property {string} id - HTML - ID Attribute of the control.
* @property {string} type - The type of event such as "click" or "change".
* @property {function} funct - The events callback function.
*/

/**
* @classdesc - Config
* @typedef {Object} Config
* @property {string} name - The name of the control.
* @property {string} label - The label of the control.
* @property {string|number|boolean|object} current - The current value of the control.
* @property {string} control_type - The type of control.
*/

/**
* @typedef {Object} Mapping - A mapping object is a reverse lookup to map Controls to a specific ControlBindings Object.
* @property {Control} control - A Control object
* @property {ControlBindings} ControlBindings - A ControlBindings object
*/

/**
* @classdesc - ControlConfig - A configuration object for a Control object, will include a rootID which is used to select the DOM element in which to insert the Control and the parent control if the new Control is a child.
* @property {function} - getRootID {@link ControlConfig#getRootID} Get the root ID of the control.
* @property {function} - setRootID {@link ControlConfig#setRootID} Set the root ID of the control.
* @property {function} - getConfing {@link ControlConfig#getConfig} Get the configuration object.
* @property {function} - setParent {@link ControlConfig#setParent} Set the parent control.
* @property {function} - getParent {@link ControlConfig#getParent} Get the parent control.
* @property {function} - isValid {@link ControlConfig#isValid} Checks for missing properties.
* @property {function} - validateConfig {@link ControlConfig#validateConfig} Checks for missing properties.
*/
class ControlConfig {
  /**
  * @property {function} - constructor
  * @param {Config} - config - A configuration object
  */
  constructor (config) {
    this.config = config
  }

  /**
  * @property {function} - setRootID {@link ControlConfig#setRootID} Set the root ID of the control.
  * @param {String} id - The ID of where to place the element.
  * @returns {void}
  */
  setRootID (id) {
    this.rootID = id
  }

  /**
  * @property {function} - getRootID {@link ControlConfig#getRootID} Get the root ID of the control.
  * @returns {String} - The ID of where to place the element.
  */
  getRootID () {
    return this.rootID
  }

  /**
  * @property {function} - getConfing {@link ControlConfig#getConfig} Get the configuration object.
  * @returns  {Config} - config - A configuration object.
  */
  getConfig () {
    return this.config
  }

  /**
  * @property {function} - setParent {@link ControlConfig#setParent} Set the parent control.
  * @param {Control} Parent - Set the parent of the control optional.
  * @returns {void}
  */
  setParent (parent = undefined) {
    this.parent = parent
  }

  /**
  * @property {function} - getParent {@link ControlConfig#getParent} Get the parent control.
  * @returns  {Control} - Parent - of the control optional.
  */
  getParent () {
    return this.parent
  }

  /**
  * @property {function} - isValid {@link ControlConfig#isValid} Checks for missing properties.
  * @returns {boolean} - Returns "False" if the configuration object is missing any of the following properties: name, label, current, control_type. - And both parent and rootID are undefined.
  */
  isValid () {
    let result = true
    // Consistency check. - do you want to re-write nested if as an AND?
    if (this.getParent() !== undefined) {
      if (this.getRootID() !== undefined) {
        if (this.parent.getID() !== this.getRootID()) {
          result = false // parrent and root_id are not consistent.
        }
      } else {
        this.setRootID(this.parent.getID())
      }
    } else {
      // Fails if the parent and the root ID are both undefined.
      if (this.rootID === undefined) {
        result = false
      }
    }

    if (result) {
      result = this.validateConfig(this.config)
    }

    return result
  }

  /**
  * @property {function} - validateConfig - {@link ControlConfig#validateConfig} Checks for missing properties within the Config Object {@link Config}.
  * @param {Config} - config - A configuration object
  * @returns {boolean} - Returns "True" if the configuration object contains the following properties: name, label, current, control_type.
  */
  validateConfig (config) {
    let keys = Object.keys(config)
    let required = ['name', 'label', 'current', 'control_type']
    for (let i = 0; i < required.length; i++) {
      if (!keys.includes(required[i])) {
        return false
      } else if ((config[required[i]] === undefined) || (config[required[i]] === null)) {
        return false
      } else if (config[required[i]] === '') {
        return false
      }
    }
    return true
  }
}

/**
* @classdesc - ControlBindings is a collection of Control objects. Features basic type-checking, serialization, and fetching.
* @property {function} - toJSON - {@link ControlBindings#toJSON} Convert the ControlBindings object into a JSON string.
* @property {function} - addMapping - {@link ControlBindings#addMapping} This method records a mapping between a Control and a ControlBindings object.
* @property {function} - append - {@link ControlBindings#append} Add a Control into the collection.
* @property {function} - includes - {@link ControlBindings#includes} to see if a Sting "key" is in use to store a Control object within "this".
* @property {function} - fetch - {@link ControlBindings#fetch} Retrieve the unique Control indexed by 'key'.
* @property {function} - fetchGlobal - {@link ControlBindings#fetchGlobal} Similar to fetch() {@link ControlBindings#fetch} but searches the entire Control Hierarchy from the top-most parent to the bottom-most child.
* @property {function} - getMapping - {@link ControlBindings#getMapping} Get the mapping array, which is stored in the highest-level or Root ControlBindings Object of the Hierarchy. The mapping is a reverse lookup to map Controls to a specific ControlBindings Object.
* @property {function} - isGlobal - {@link ControlBindings#isGlobal} Tests if this is the global or top most ControlBindings Object in the Control Hierarchy.
* @property {function} - getKeys - {@link ControlBindings#getKeys} Get an array of keys, one for each local element.
*/

class ControlBindings {
  /**
  * @property {Array<Control>} - data - An array of Control objects.
  */
  #data = []
  /**
  * @property {Array<Mapping>} - mapping - An array of mapping objects. A mapping object is a reverse lookup to map Controls to a specific ControlBindings Object.
  */
  #mapping = []
  /**
  * @property {function} - toJSON - {@link ControlBindings#toJSON} Convert the ControlBindings object into a JSON string.
  * @return {Object} - JSON Collection of objects representing the state of every control in "this."
  */
  toJSON () {
    let result = {}
    let keys = this.getKeys()
    for (let i = 0; i < keys.length; i++) {
      let selected = this.fetch(keys[i])
      if (selected.isChild() === false) {
        let name = selected.getConfig().name
        result[name] = selected.getConfig()
      }
    }
    return result
  }

  /**
    * @property {function} This method records a mapping between a Control and a ControlBindings object.
    * @param {Control} control - A Control object
    * @param {ControlBindings} binding - A ControlBindings object
    * @returns {void}
    */
  addMapping (control, binding) {
    let mapping = this.getMapping()
    mapping.push({ control, map: binding })
  }

  /**
  * @property {function} - append - {@link ControlBindings#append} Add a Control into the collection.
  * @returns {void}
  * @throws err - described as a key error     *
  * @param {Control} control - A Control object will be keyed by Controls.getID() into the collection. - But if that key is already in use, an error is thrown.
  */
  append (control) {
    let data = this.#data
    if (control instanceof Control) {
      if (!this.includes(control.getID())) {
        data.push(control)
        this.addMapping(control, this)
      } else {
        let err = 'Key Error:\tduplicate'
        throw err
      }
    } else {
      let err = 'TYPE:\tAn instance of Control is required'
      throw err
    }
  }

  /**
  * @property {function} - includes - {@link ControlBindings#includes} to see if a Sting "key" is in use to store a Control object within "this".
  * @param {String} key - A valid key string. 'Key' is the id attribute of the HTML tag, therefore, keys are unique.
  * @returns - true - True if a Control is in this collection using a key equal to "key."
  */
  includes (key) {
    let keys = this.getKeys()
    return keys.includes(key)
  }

  /**
  * @property {function} - fetch - {@link ControlBindings#fetch} Retrieve the unique Control indexed by 'key'. This is local search only. A Control may use this function to access Child Controls.
  * @throws {Error} -If the key is not found an error is thrown. Described as a key error.
  * @param {String} key - A valid key string which is the "id" attribute of the HTML tag, therefore, keys are unique.
  * @returns {Control} - The control Control stored internally under "key".
  */
  fetch (key) {
    let data = this.#data
    if (this.includes(key)) {
      for (let i = 0; i < data.length; i++) {
        if (data[i].getID() === key) {
          return data[i]
        }
      }
    } else {
      throw new Error('Key Error:\tkey not found, LOCAL')
    }
  }

  /**
  * @property {function} - fetchGlobal - {@link ControlBindings#fetchGlobal} Similar to fetch() but searches the global entire Control hierarchy from the top-most parent to the bottom-most child.
  * @throws {err} - Described as a key error.
  * @param {String} key - A valid key string which is the "id" attribute of the HTML tag, therefore, keys are unique.
  * @returns {Control} - The Control indexed under "key".
  */
  fetchGlobal (key) {
    let map = this.getMapping()
    for (let i = 0; i < map.length; i++) {
      let selected = map[i]
      if (selected.control.getID() === key) {
        return selected.map.fetch(key)
      }
    }
    throw new Error('Key Error:\tkey not found, GLOBAL')
  }

  /**
  * @property {function} - getMapping - {@link ControlBindings#getMapping} Get the mapping array, which is stored in the highest-level or Root ControlBindings Object of the Hierarchy. The mapping is a reverse lookup to map Controls to a specific ControlBindings Object.
  * @returns {Array} - Array of mapping objects
  **/
  getMapping () {
    if (this.isGlobal()) {
      return this.#mapping
    } else {
      return global.dudezilla.bindings.getMapping()
    }
  }

  /**
  * @property {function} - isGlobal - {@link ControlBindings#isGlobal} Tests if this is the global or top most ControlBindings Object in the Control Hierarchy.
  * @returns {boolean} - true if this is the global ControlBindings object for this Control hierarchy.
  * @returns {boolean} - false if this is a child element.
  */
  isGlobal () {
    return (this === global.dudezilla.bindings)
  }

  /**
  * @property {function} - getKeys - {@link ControlBindings#getKeys} Get an array of keys, one for each local element.
  * @returns {Array<String>} - keys - Array of keys, one for each local element.
  */
  getKeys () {
    let data = this.#data
    let keys = []
    for (let i = 0; i < data.length; i++) {
      keys.push(data[i].getID())
    }
    return keys
  }
}

/**
* The find function is an entry point for recursive search through the Control objects.
* Control objects are implemented in HTML so "id" refers to the id attribute of the html tag.
* @function {function} - find - {@link ControlBindings#find} Find a Control object by id.
* @param {Control} el - A Control object
* @param {String} id - A valid key string / Is also the id attribute of the html tag.
* @memberof ControlBindings
*/
function find (el, id) {
  // let loc = el
  if (el.id === id) {
    return el
  } else {
    return visitChildren(el.children, id)
  }
}

function visitChildren (queue, id) {
  let newQueue = []
  for (let i = 0; i < queue.length; i++) {
    if (queue[i].id === id) {
      return queue[i]
    } else {
      let children = queue[i].children
      for (let j = 0; j < children.length; j++) {
        newQueue.push(children[j])
      }
    }
  }
  if (newQueue.length > 0) {
    return visitChildren(newQueue, id)
  } else {
    throw new Error('visit_children: id not found')
    // return;
  }
}

module.exports.ControlBindings = ControlBindings
module.exports.find = find
module.exports.Control = Control
module.exports.ControlConfiguration = ControlConfig
