import { Control, ControlConfiguration } from '../ControlCollection.js'
import { CodeSnippetControl } from './CodeSnippetControl.js'

/**
 * @classdesc CollapsibleCodeControl - A composite control containing a clickable
 * heading and a CodeSnippetControl child. Clicking the heading toggles the
 * visibility of the code block.
 *
 * config.label  — The heading text shown to the user.
 * config.state — The code string to display inside the snippet.
 *
 * Example config:
 * {
 *   name: "my_snippet",
 *   label: "Click to expand",
 *   state: "const x = 1;",
 *   control_type: "collapsible_code"
 * }
 */
class CollapsibleCodeControl extends Control {
  /**
   * @param {ControlConfiguration} controlConfig
   */
  constructor (controlConfig) {
    super(controlConfig)
    this._makeSnippetChild()
    this.element = this.makeElement()
  }

  /**
   * Create the CodeSnippetControl child and register it in subControls.
   * The child's label is left empty — the parent heading owns the label.
   */
  _makeSnippetChild () {
    const snippetConfig = new ControlConfiguration({
      name: 'snippet',
      label: ' ',
      state: this.getValue(),
      control_type: 'code_snippet'
    })
    snippetConfig.setParent(this)
    this._snippet = new CodeSnippetControl(snippetConfig)
    this.appendChild(this._snippet)
  }

  /**
   * Build the composite DOM element:
   *   <div id="...">
   *     <h3>label</h3>       ← clickable heading
   *     <figure>...</figure> ← CodeSnippetControl element
   *   </div>
   * @returns {HTMLElement}
   */
  makeElement () {
    const wrapper = document.createElement('div')
    wrapper.id = this.getID()

    const heading = document.createElement('h3')
    heading.textContent = this.getLabel()
    heading.setAttribute('aria-expanded', 'true')

    const snippetEl = this._snippet.getElement()

    heading.addEventListener('click', () => {
      const isVisible = snippetEl.style.display !== 'none'
      snippetEl.style.display = isVisible ? 'none' : ''
      heading.setAttribute('aria-expanded', String(!isVisible))
      this.eventLinkage({ visible: !isVisible, id: this.getID() })
    })

    wrapper.appendChild(heading)
    wrapper.appendChild(snippetEl)

    return wrapper
  }

  /**
   * Called by the parent when a child fires eventLinkage.
   * The snippet child does not fire events directly, so this is a no-op here.
   * Subclasses may override to react to child state changes.
   * @param {*} stateChange
   */
  onChildEvent (stateChange) {
    // no-op: snippet child does not fire child events
  }

  /**
   * Returns true if the code block is currently visible.
   * @returns {boolean}
   */
  isExpanded () {
    const snippetEl = this._snippet.getElement()
    return snippetEl ? snippetEl.style.display !== 'none' : true
  }

  /**
   * Programmatically set the code string and push it to the view.
   * @param {string} code
   */
  setCode (code) {
    this.setValue(code)
    this._snippet.setValue(code)
    this._snippet.updateView()
  }
}

CollapsibleCodeControl.controlType = 'collapsible_code'

CollapsibleCodeControl.meta = {
  controlType:   'collapsible_code',
  category:      'composite',
  description:   'A clickable h3 heading that shows/hides a CodeSnippetControl child. setCode() updates the snippet content programmatically.',
  defaultConfig: { name: 'test_cc', label: 'Click to expand', state: 'const x = 1;', control_type: 'collapsible_code' },
  tests: [
    {
      name: 'getValue returns initial code string',
      fn: function (ctrl) { return ctrl.getValue() === 'const x = 1;' }
    },
    {
      name: 'isExpanded returns true initially',
      fn: function (ctrl) { return ctrl.isExpanded() === true }
    },
    {
      name: 'has a CodeSnippetControl child',
      fn: function (ctrl) { return ctrl.subControls.size > 0 }
    },
    {
      name: 'DOM contains an h3 heading with the label',
      fn: function (ctrl) {
        var h3 = ctrl.getElement().querySelector('h3')
        return h3 !== null && h3.textContent === 'Click to expand'
      }
    },
    {
      name: 'setCode updates the snippet value',
      fn: function (ctrl) {
        ctrl.setCode('let y = 99;')
        return ctrl.getValue() === 'let y = 99;'
      }
    },
    {
      name: 'buildSubControls returns a DOM element',
      fn: function (ctrl) { var el = ctrl.getElement(); return !!el && el.nodeType === 1 }
    },
    {
      name: 'DOM contains pre>code block',
      fn: function (ctrl) { return ctrl.getElement().querySelector('pre > code') !== null }
    },
  ]
}

export { CollapsibleCodeControl }
