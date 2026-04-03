import { Control } from '../ControlCollection.js'

/**
 * @classdesc TextInputControl — single-line text entry.
 *
 * Fires eventLinkage on every keystroke (`input` event).
 * setValue() keeps the DOM input in sync.
 *
 * Config:
 *   { name, label, state: '', control_type: 'text_input',
 *     placeholder?: '', maxlength?: 200 }
 */
class TextInputControl extends Control {
  constructor (controlConfig) {
    super(controlConfig)
    this.element = this._makeElement()
    this.appendHandler({
      id:   this.getID(),
      type: 'input',
      func: textInputHandler,
    })
  }

  _makeElement () {
    const wrapper = document.createElement('div')
    wrapper.className = 'ctrl ctrl-text-input'

    const label = document.createElement('label')
    label.className = 'ctrl-label'
    label.htmlFor   = this.getID()
    label.textContent = this.getLabel()
    wrapper.appendChild(label)

    const input = document.createElement('input')
    input.type      = 'text'
    input.id        = this.getID()
    input.className = 'ctrl-text-field'
    input.value     = this.getValue() || ''

    if (this.config.placeholder !== undefined) input.placeholder = this.config.placeholder
    if (this.config.maxlength)                 input.maxLength   = parseInt(this.config.maxlength)

    wrapper.appendChild(input)
    return wrapper
  }

  getValue () {
    return this.config.state
  }

  setValue (v) {
    this.config.state = (v === undefined || v === null) ? '' : String(v)
    const input = this.getElement().querySelector('input.ctrl-text-field')
    if (input) input.value = this.config.state
  }
}

function textInputHandler () {
  const control = globalThis.dudezilla.bindings.fetchGlobal(this.id)
  control.setValue(this.value)
  control.eventLinkage(this.value)
}

TextInputControl.controlType = 'text_input'

TextInputControl.meta = {
  controlType:   'text_input',
  category:      'input',
  description:   'Single-line text entry. Fires eventLinkage on every keystroke. setValue() keeps the DOM input in sync with config.state.',
  defaultConfig: {
    name:         'test_text',
    label:        'Text Field',
    state:      'Sample text',
    control_type: 'text_input',
    placeholder:  'Type something...',
  },
  tests: [
    {
      name: 'getValue returns initial value from config',
      fn: function (ctrl) { return ctrl.getValue() === 'Sample text' }
    },
    {
      name: 'setValue / getValue roundtrip',
      fn: function (ctrl) { ctrl.setValue('hello'); return ctrl.getValue() === 'hello' }
    },
    {
      name: 'setValue(null) coerces to empty string',
      fn: function (ctrl) { ctrl.setValue(null); return ctrl.getValue() === '' }
    },
    {
      name: 'setValue(number) coerces to string',
      fn: function (ctrl) { ctrl.setValue(42); return ctrl.getValue() === '42' }
    },
    {
      name: 'buildSubControls returns a DOM element',
      fn: function (ctrl) { var el = ctrl.getElement(); return !!el && el.nodeType === 1 }
    },
    {
      name: 'DOM contains input[type=text]',
      fn: function (ctrl) { return ctrl.getElement().querySelector('input[type=text]') !== null }
    },
    {
      name: 'label element shows configured label text',
      fn: function (ctrl) {
        var lbl = ctrl.getElement().querySelector('label')
        return lbl !== null && lbl.textContent === 'Text Field'
      }
    },
    {
      name: 'placeholder attribute is set on the input',
      fn: function (ctrl) {
        var inp = ctrl.getElement().querySelector('input')
        return inp !== null && inp.placeholder === 'Type something...'
      }
    },
    {
      name: 'setValue updates the DOM input value',
      fn: function (ctrl) {
        ctrl.setValue('mirror')
        var inp = ctrl.getElement().querySelector('input')
        return inp !== null && inp.value === 'mirror'
      }
    },
    {
      name: 'input element id matches getID()',
      fn: function (ctrl) {
        var inp = ctrl.getElement().querySelector('input')
        return inp !== null && inp.id === ctrl.getID()
      }
    },
  ]
}

export { TextInputControl }
