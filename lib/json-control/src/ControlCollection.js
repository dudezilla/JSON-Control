import * as Logger from './ControlLogger.js'

// ID_SEPARATOR — the canonical tier boundary used in every hierarchical ID.
// Dots are prohibited (they break CSS selectors).  Single underscores are
// allowed in control names, so __ is unambiguous as a split target.
//
//   'workspace__rootA__track1__page1'.split(ID_SEPARATOR)
//   → ['workspace', 'rootA', 'track1', 'page1']
//
//   depth  = parts.length - 1
//   parent = parts.slice(0, -1).join(ID_SEPARATOR)
const ID_SEPARATOR = '__'

/**
* @classdesc - An abstract class for all controls.
* @property {function} - constructor
* @property {object} - config - The configuration object.
* @property {string} - rootID - HTML ID Attribute of the Root Tag.
* @property {Control} - parent - A collection of child controls.
* @property {Array<String>} - htmlBuffer - A buffer for constructing the "innerHTML".
* @property {ControlRegistry} - subControls - The child elements.
* @property {Array<HandlerSerialization>} - handlers - An array of event handlers for this control.
* @property {function} - getElement - {@link Control#getElement} Fetch the DOM Element representation of this control. @todo - fetch_element() renamed to getElement()
* @property {function} - buildSubControls - {@link Control#buildSubControls} Populate the DOM element with the child elements.
* @property {function} - applyHandlers - {@link Control#applyHandlers} Deserialize the event handlers (see - {@link HandlerSerialization}) and apply them to the DOM elements, then call applySubControlHandlers.
* @property {function} - applySubControlHandlers - {@link Control#applySubControlHandlers} Every Control in the ControlRegistry Object potentially has an event handler.
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
    try {
      if (!controlConfig.isValid()) {
        Logger.critical('Control.constructor', 'Invalid configuration — construction aborted', {
          config: controlConfig && controlConfig.config,
        })
        throw new Error('Control:constructor - Invalid Configuration')
      }
    } catch (err) {
      if (err.message === 'Control:constructor - Invalid Configuration') throw err
      Logger.critical('Control.constructor', 'Unexpected error during config validation', { error: err.message })
      throw err
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
    * @property {ControlRegistry} - subControls - The child elements.
    */
    // subControls is a live view over the singleton — not a local store.
    // ControlLevelEnumerator filters ControlRegistry.instance for direct
    // children of this control (one extra tier beyond this.getID()).
    this.subControls = new ControlLevelEnumerator(this)

    // Auto-register ROOT controls only.
    // Child controls are registered when the parent calls subControls.append()
    // (→ ControlLevelEnumerator.append() → ControlRegistry.instance.append()).
    // Registering a child here AND in append() would cause a duplicate-key error.
    if (!this.isChild()) {
      ControlRegistry.instance.append(this)
    }

    /**
    * @property {Array<HandlerSerialization>} - handlers - An array of event handlers for this control.
    */
    this.handlers = []

    Logger.debug('Control.constructor', 'Control created', {
      name:         this.config.name,
      control_type: this.config.control_type,
    })
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
    const subAnchor = this.getElement()
    for (const ctrl of this.subControls) {
      try {
        subAnchor.appendChild(ctrl.buildSubControls())
      } catch (err) {
        Logger.warning('Control.buildSubControls', 'Failed to build sub-control', {
          child:  ctrl.getName && ctrl.getName(),
          error:  err.message,
        })
      }
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
    const handlers = this.handlers
    for (let i = 0; i < handlers.length; i++) {
      const handler = handlers[i]
      try {
        const el = document.getElementById(handler.id)
        if (!el) {
          Logger.warning('Control.applyHandlers', 'Element not found for handler — skipping', {
            control: this.getName(),
            id:      handler.id,
            type:    handler.type,
          })
          continue
        }
        el.addEventListener(handler.type, handler.func)
        Logger.debug('Control.applyHandlers', 'Handler attached', {
          control: this.getName(),
          id:      handler.id,
          type:    handler.type,
        })
      } catch (err) {
        Logger.warning('Control.applyHandlers', 'Failed to attach handler', {
          control: this.getName(),
          id:      handler.id,
          type:    handler.type,
          error:   err.message,
        })
      }
    }
    try {
      this.applySubControlHandlers()
    } catch (err) {
      Logger.warning('Control.applyHandlers', 'Failed in applySubControlHandlers', {
        control: this.getName(),
        error:   err.message,
      })
    }
  }

  /**
  * @property {function}  - applySubControlHandlers - {@link Control#applySubControlHandlers} Every Control in the ControlRegistry Object potentially has an event handler.
  * @returns {void}
  */
  applySubControlHandlers () {
    for (const ctrl of this.subControls) {
      ctrl.applyHandlers()
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
    return this.htmlBuffer.join('')
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
    if (this._id !== undefined) return this._id
    const prefix = this.isChild() ? this.parent.getID() : this.rootID
    this._id = `${prefix}${ID_SEPARATOR}${this.getName()}`
    return this._id
  }

  /**
  * @property {function} - {@link Control#setValue} Set the value of the control.
  * @param {string} - value - a value that the control will assume.
  */
  setValue (value) {
    Logger.debug('Control.setValue', 'Value set', { control: this.config.name, value: value })
    this.getConfig().state = value
  }

  /**
   * @property {function}  - {@link Control#getValue} Get the value of the control.
   * @returns {string} - the value of the control.
   */
  getValue () {
    return this.config.state
  }

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
    Logger.debug('Control.eventLinkage', 'Event propagation', {
      control:  this.config.name,
      isChild:  this.isChild(),
      change:   state_change,
    })
    if (this.isChild()) {
      try {
        this.parent.onChildEvent(state_change)
      } catch (err) {
        Logger.warning('Control.eventLinkage', 'onChildEvent threw', {
          control: this.config.name,
          parent:  this.parent.getName && this.parent.getName(),
          error:   err.message,
        })
        throw err
      }
    }
  }

  /**
  * @todo - naming convention - some research on naming event_listeners.}
  * @property {function} - onChildEvent - {@link Control#onChildEvent} How will the control respond to the event?
  * @param {object} - state_change - @todo verify this is an event object
  * @abstract - override this method and interpret the state change.
  */
  onChildEvent (state_change) {
    Logger.warning('Control.onChildEvent', 'Abstract onChildEvent called — subclass must override', {
      control: this.config && this.config.name,
      change:  state_change,
    })
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
    return `Control:\t${this.getID()}\n\tname:\t${this.getName()}\n\tlabel:\t${this.getLabel()}`
  }

  /**
  * @property {function} - toString - {@link Control#toString} Produce and return a formatted string containing the id, name, and label.
  * @todo - Config needs a type definition.
  * @returns {string} - A JSON String representing the control.
  */
  getJSON () {
    let result = `id:${this.getID()}\nconfig = ${this.config}\n`
    for (const ctrl of this.subControls) {
      result += ctrl.getJSON()
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
* @typedef {Object} Mapping - A mapping object is a reverse lookup to map Controls to a specific ControlRegistry Object.
* @property {Control} control - A Control object
* @property {ControlRegistry} ControlRegistry - A ControlRegistry object
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
    const required = ['name', 'label', 'state', 'control_type']
    for (let i = 0; i < required.length; i++) {
      const val = config[required[i]]
      if (val === undefined || val === null || val === '') return false
    }
    return true
  }
}

/**
* @classdesc - ControlRegistry is a collection of Control objects. Features basic type-checking, serialization, and fetching.
* @property {function} - toJSON - {@link ControlRegistry#toJSON} Convert the ControlRegistry object into a JSON string.
* @property {function} - addMapping - {@link ControlRegistry#addMapping} This method records a mapping between a Control and a ControlRegistry object.
* @property {function} - append - {@link ControlRegistry#append} Add a Control into the collection.
* @property {function} - includes - {@link ControlRegistry#includes} to see if a Sting "key" is in use to store a Control object within "this".
* @property {function} - fetch - {@link ControlRegistry#fetch} Retrieve the unique Control indexed by 'key'.
* @property {function} - fetchGlobal - {@link ControlRegistry#fetchGlobal} Similar to fetch() {@link ControlRegistry#fetch} but searches the entire Control Hierarchy from the top-most parent to the bottom-most child.
* @property {function} - getMapping - {@link ControlRegistry#getMapping} Get the mapping Map, which is stored in the highest-level or Root ControlRegistry Object of the Hierarchy. The mapping is a reverse lookup to map Controls to a specific ControlRegistry Object.
* @property {function} - isGlobal - {@link ControlRegistry#isGlobal} Tests if this is the global or top most ControlRegistry Object in the Control Hierarchy.
* @property {function} - getKeys      - {@link ControlRegistry#getKeys} Get an array of keys, one for each local element.
* @property {function} - forEach      - {@link ControlRegistry#forEach} Iterate over every Control in insertion order.
* @property {function} - [Symbol.iterator] - Makes ControlRegistry natively iterable: `for (const ctrl of bindings)`.
* @property {function} - entries      - {@link ControlRegistry#entries} Yields [id, Control] pairs — use with destructuring.
* @property {function} - values       - {@link ControlRegistry#values} Explicit values iterator (alias for Symbol.iterator).
* @property {function} - keys         - {@link ControlRegistry#keys} Yields all registered control IDs.
* @property {number}   - size         - Number of controls in this bindings instance.
* @property {function} - toValueMap   - {@link ControlRegistry#toValueMap} Returns a Map<name, value> snapshot of all controls.
*/

class ControlRegistry {
  // ── Singleton ──────────────────────────────────────────────────────────────
  static #instance = null

  /** The one global registry.  Lazy-initialised on first access. */
  static get instance () {
    if (!ControlRegistry.#instance) ControlRegistry.#instance = new ControlRegistry()
    return ControlRegistry.#instance
  }

  /**
   * Clear the registry.  Intended for test isolation only — call in
   * beforeEach() so controls from one test do not bleed into the next.
   */
  static reset () { ControlRegistry.#instance = null }

  // ── Instance ───────────────────────────────────────────────────────────────
  /** @type {Map<string, Control>} Controls keyed by their full path ID. */
  #data = new Map()

  /**
  * @property {function} - toJSON - Convert the registry to a JSON-serialisable object.
  * @return {Object} - Name → config for every non-child control.
  */
  toJSON () {
    const result = {}
    for (const control of this.#data.values()) {
      if (!control.isChild()) {
        result[control.getConfig().name] = control.getConfig()
      }
    }
    return result
  }

  /**
  * Add a control to the registry.
  * Accepts any object that satisfies the duck-type interface (getID, getName,
  * getValue, isChild, getConfig) so that test mocks and real Controls alike
  * can be registered without requiring an instanceof check.
  *
  * @param {Control|object} control - A Control or duck-typed equivalent.
  * @throws {string} TYPE error if control does not implement getID().
  * @throws {string} Key Error if the ID is already registered.
  */
  append (control) {
    if (typeof control.getID !== 'function') {
      Logger.critical('ControlRegistry.append', 'Type error — control does not implement getID()', {
        received: typeof control,
      })
      throw 'TYPE:\tAn instance of Control is required'
    }
    const id = control.getID()
    if (this.#data.has(id)) {
      Logger.critical('ControlRegistry.append', 'Duplicate key — control already registered', { id: id })
      throw 'Key Error:\tduplicate'
    }
    this.#data.set(id, control)
    Logger.debug('ControlRegistry.append', 'Control registered', { id: id })
  }

  /**
  * @param {string} key - Full path ID.
  * @returns {boolean} True if the key is registered.
  */
  includes (key) {
    return this.#data.has(key)
  }

  /**
  * Retrieve a control by its full path ID.
  * @param {string} key - Full path ID.
  * @returns {Control}
  * @throws {Error} Key Error if not found.
  */
  fetch (key) {
    const ctrl = this.#data.get(key)
    if (ctrl !== undefined) return ctrl
    Logger.warning('ControlRegistry.fetch', 'Key not found', { key: key })
    throw new Error('Key Error:\tkey not found')
  }

  /**
  * Yield controls matching a path pattern.
  *
  *   'ws__rootA__*'   → direct children of ws__rootA only
  *   'ws__rootA__**'  → all descendants of ws__rootA at any depth
  *
  * @param {string} pattern - Path prefix ending with * or **.
  * @yields {Control}
  */
  * getControlsByPath (pattern) {
    const deep   = pattern.endsWith('**')
    const prefix = pattern.replace(/\*+$/, '')
    const parentParts = prefix.split(ID_SEPARATOR).filter(Boolean)
    for (const [id, ctrl] of this.#data) {
      if (!id.startsWith(prefix)) continue
      const parts = id.split(ID_SEPARATOR)
      if (deep || parts.length === parentParts.length + 1) yield ctrl
    }
  }

  /**
  * @returns {Array<string>} Array of all registered path IDs.
  */
  getKeys () {
    return Array.from(this.#data.keys())
  }

  /**
  * @param {function} callback - Called with each Control in insertion order.
  */
  forEach (callback) {
    for (const ctrl of this.#data.values()) {
      callback(ctrl)
    }
  }

  /** Natively iterable — yields each Control in insertion order. */
  [Symbol.iterator] () {
    return this.#data.values()
  }

  /** @returns {Iterator<[string, Control]>} [id, Control] pairs in insertion order. */
  entries () {
    return this.#data.entries()
  }

  /** Explicit alias for [Symbol.iterator]. */
  values () {
    return this.#data.values()
  }

  /** @returns {Iterator<string>} All registered path IDs in insertion order. */
  keys () {
    return this.#data.keys()
  }

  /** @returns {number} Number of controls currently in the registry. */
  get size () {
    return this.#data.size
  }

  /**
  * Snapshot of every control's current value, keyed by short name.
  * @returns {Map<string, *>}
  */
  toValueMap () {
    const result = new Map()
    for (const ctrl of this) {
      result.set(ctrl.getName(), ctrl.getValue())
    }
    return result
  }
}

/**
* The find function is an entry point for recursive search through the Control objects.
* Control objects are implemented in HTML so "id" refers to the id attribute of the html tag.
* @function {function} - find - {@link ControlRegistry#find} Find a Control object by id.
* @param {Control} el - A Control object
* @param {String} id - A valid key string / Is also the id attribute of the html tag.
* @memberof ControlRegistry
*/
/**
 * ControlLevelEnumerator — a live view of the ControlRegistry singleton
 * scoped to the direct children of one parent control.
 *
 * It holds NO state of its own.  Every iterator call reads from
 * ControlRegistry.instance at that moment.  append() registers into the
 * singleton rather than a local list, so the child is immediately visible to
 * any other part of the system that holds a reference to the singleton.
 */
class ControlLevelEnumerator {
  #parent

  constructor (parent) {
    this.#parent = parent
  }

  #childPrefix () {
    return this.#parent.getID() + ID_SEPARATOR
  }

  /**
   * Register a control as a direct child of this enumerator's parent.
   * The control is stored in ControlRegistry.instance, not locally.
   */
  append (control) {
    ControlRegistry.instance.append(control)
  }

  /**
   * Retrieve a direct child by its short name.
   * @param {string} name - The child's config.name (not the full path ID).
   * @returns {Control}
   */
  fetch (name) {
    return ControlRegistry.instance.fetch(this.#childPrefix() + name)
  }

  /**
   * @param {string} name - Short name.
   * @returns {boolean}
   */
  includes (name) {
    return ControlRegistry.instance.includes(this.#childPrefix() + name)
  }

  /** Yields each direct child of the parent in insertion order. */
  [Symbol.iterator] () {
    return ControlRegistry.instance.getControlsByPath(this.#childPrefix() + '*')
  }

  /** @param {function} callback - Called with each direct child. */
  forEach (callback) {
    for (const ctrl of this) callback(ctrl)
  }

  /** @returns {Iterator<[string, Control]>} [pathID, Control] pairs for direct children. */
  * entries () {
    for (const ctrl of this) yield [ctrl.getID(), ctrl]
  }

  /** Explicit alias for [Symbol.iterator]. */
  values () {
    return this[Symbol.iterator]()
  }

  /** @returns {Iterator<string>} Path IDs of direct children. */
  * keys () {
    for (const ctrl of this) yield ctrl.getID()
  }

  /** @returns {Array<string>} Array of direct child path IDs. */
  getKeys () {
    return [...this.keys()]
  }

  /** @returns {number} Count of direct children. */
  get size () {
    let n = 0
    for (const _ of this) n++ // eslint-disable-line no-unused-vars
    return n
  }

  /**
   * Snapshot of direct children's current values, keyed by short name.
   * @returns {Map<string, *>}
   */
  toValueMap () {
    const result = new Map()
    for (const ctrl of this) result.set(ctrl.getName(), ctrl.getValue())
    return result
  }
}

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
      const children = queue[i].children
      for (let j = 0; j < children.length; j++) {
        newQueue.push(children[j])
      }
    }
  }
  if (newQueue.length > 0) {
    return visitChildren(newQueue, id)
  } else {
    throw new Error('visit_children: id not found')
  }
}

export { ID_SEPARATOR, ControlRegistry, ControlLevelEnumerator, find, Control }
export { ControlConfig as ControlConfiguration }
