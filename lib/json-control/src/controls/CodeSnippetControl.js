import { Control } from '../ControlCollection.js'

/**
 * @classdesc CodeSnippetControl - Renders a code snippet inside a <pre><code> block.
 * The "state" value of the config is the raw code string to display.
 * HTML special characters are escaped so the snippet renders correctly regardless of content.
 *
 * Example config:
 * {
 *   name: "my_snippet",
 *   label: "Example:",
 *   state: "const x = 1 < 2;",
 *   control_type: "code_snippet"
 * }
 */
class CodeSnippetControl extends Control {
  /**
   * @param {ControlCollection.ControlConfig} controlConfig - A configuration object.
   */
  constructor (controlConfig) {
    super(controlConfig)
    this.element = this.makeElement()
  }

  /**
   * Escape HTML special characters so raw code displays correctly inside <code>.
   * @param {string} str - Raw code string.
   * @returns {string} - HTML-safe string.
   */
  escapeHTML (str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }

  /**
   * Build the outer <figure> element containing an optional <figcaption> label
   * and a <pre><code> block with the escaped code snippet.
   * @returns {HTMLElement}
   */
  makeElement () {
    const wrapper = document.createElement('figure')
    wrapper.id = this.getID()

    if (this.getLabel() && this.getLabel().trim()) {
      const caption = document.createElement('figcaption')
      caption.textContent = this.getLabel()
      wrapper.appendChild(caption)
    }

    const pre = document.createElement('pre')
    const code = document.createElement('code')
    code.innerHTML = this.escapeHTML(this.getValue())
    pre.appendChild(code)
    wrapper.appendChild(pre)

    return wrapper
  }

  /**
   * Push the current value to the view without rebuilding the whole element.
   */
  updateView () {
    const code = this.getElement().querySelector('code')
    if (code) {
      code.innerHTML = this.escapeHTML(this.getValue())
    }
  }
}

CodeSnippetControl.controlType = 'code_snippet'

CodeSnippetControl.meta = {
  controlType:   'code_snippet',
  category:      'display',
  description:   'Renders a code string inside a <pre><code> block with HTML escaping. updateView() replaces content without rebuilding.',
  defaultConfig: { name: 'test_cs', label: 'Example:', state: 'const x = 1 < 2;', control_type: 'code_snippet' },
  tests: [
    {
      name: 'getValue returns initial code string',
      fn: function (ctrl) { return ctrl.getValue() === 'const x = 1 < 2;' }
    },
    {
      name: 'setValue / getValue roundtrip',
      fn: function (ctrl) { ctrl.setValue('let y = 2;'); return ctrl.getValue() === 'let y = 2;' }
    },
    {
      name: 'escapeHTML encodes < > & characters',
      fn: function (ctrl) {
        var out = ctrl.escapeHTML('<script>&"\'</script>')
        return out === '&lt;script&gt;&amp;&quot;&#039;&lt;/script&gt;'
      }
    },
    {
      name: 'DOM contains <pre><code> structure',
      fn: function (ctrl) {
        return ctrl.getElement().querySelector('pre > code') !== null
      }
    },
    {
      name: 'code content is HTML-escaped in the DOM',
      fn: function (ctrl) {
        var code = ctrl.getElement().querySelector('code')
        return code !== null && !code.innerHTML.includes('<')
      }
    },
    {
      name: 'updateView replaces <code> content',
      fn: function (ctrl) {
        ctrl.setValue('var z = 3;')
        ctrl.updateView()
        var code = ctrl.getElement().querySelector('code')
        return code !== null && code.textContent === 'var z = 3;'
      }
    },
    {
      name: 'figcaption shows the label',
      fn: function (ctrl) {
        var cap = ctrl.getElement().querySelector('figcaption')
        return cap !== null && cap.textContent === 'Example:'
      }
    },
  ]
}

export { CodeSnippetControl }
