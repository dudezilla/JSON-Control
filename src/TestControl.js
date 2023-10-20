const ControlCollection = require('./ControlCollection.js')
const ControlBindings = ControlCollection.Control_Bindings
const Control = ControlCollection.Control
const document = global.window.document

class TestControl extends Control {
  //    #displayed_text

  constructor (controlConfig) {
    super(controlConfig)

    //        this.#displayed_text = document.createElement("div");
    //        this.#displayed_text.classList.add("textual_content");
    this.displayedText = document.createElement('div')

    this.makeSubs()
    this.element = this.makeElement()
    this.appendHandler({
      id: this.getID(),
      type: 'click',
      func: testHandler
    })
  }

  /**
   * IT is the responsibility of the parent to append the child "Element objects".
   * This element does not follow the pattern of recursively pulling and appending the elements.
   * The following code does nothing.
   * - A solution have make element call - getElement() on the children and append them to the element.
   * {@link ControlCollection.Control#makeElement}
   */
  makeSubs () {
    let vals = this.getValue()
    let controlConfig = null
    for (let i = 0; i < vals; i++) {
      const config = {
        name: `sub${i}`,
        label: `sub control_${i}:`,
        current: i,
        control_type: 'test_control'
      }
      controlConfig = new ControlCollection.ControlConfiguration(config)
      controlConfig.setParent(this)

      this.appendChild(new TestControl(controlConfig))
    }
  }

  makeElement () {
    const el = document.createElement('div')
    el.innerHTML = this.buildString()
    el.appendChild(this.getDisplayedText())

    //new code.
    let children = this.subControls.getKeys()
    //let child = null
    for (let i = 0; i < children.length; i++) {
       el.appendChild(this.subControls.fetch(children[i]).getElement())
    }
    return el
  }

  buildString () {
    this.appendInnerText(this.toString())
    this.appendHTML('<label>')
    this.appendHTML(`<input type='checkbox' id='${this.getID()}' ></input>`)
    this.appendHTML(`${this.getLabel()}</label>`)
    return this.getHTML()
  }

  getDisplayedText () {
    return this.displayedText
  }

  appendInnerText (textString) {
    const textEl = this.getDisplayedText()
    const text = document.createTextNode(textString)
    const p = document.createElement('p')
    p.appendChild(text)
    textEl.appendChild(p)
  }

  /**
     * Would this not append the text to the root element under the anchor element?
     */
  appendRootText (textString) {
    const root = this.getRoot()
    root.appendInnerText(textString)
  }

  // AND the pass through from child to parrent invloves calling:
  // Event linkage from the handler.

  onChildEvent (stateChange) {
    let msg = '.on_child_listen_event() called'
    if (this === stateChange) {
      msg += 'This - the parrent el triggered the event'
    } else {
      msg += 'A child element triggered the event.'
    }
    console.log(msg)
    // this.append_inner_text(msg);
  }
}

// AND the pass through from child to parrent invloves calling:
// Event linkage from the handler.
function testHandler () {
  const control = global.dudezilla.bindings.fetchGlobal(this.id)
  control.setValue(this.checked)
  const root = control.getRoot()
  const conf = control.getConfig()
  const cKeys = Object.keys(conf)
  let cRes = control.getID() + ' Config:\n'
  for (let i = 0; i < cKeys.length; i++) {
    cRes += `\t${cKeys[i]}:${conf[cKeys[i]]}\n`
  }

  root.appendRootText(cRes)
  root.appendRootText("\nCalling event linkage, passing 'control'")
  // let root = control.getRoot();
  control.eventLinkage(root)
}
module.exports.TestControl = TestControl
