import { Control } from '../ControlCollection.js'

/**
 * @classdesc ConfigUploadControl — a file-picker button that reads a JSON file
 * and fires eventLinkage with the parsed config object.
 *
 * Typical usage:
 *   uploadCtrl.onEvent(function(cfg) { pageCtrl.setValue(cfg) })
 *   // user picks a .json file → cfg is the parsed object
 *
 * Config:
 *   { name, label, state: {}, control_type: 'config_upload',
 *     accept?: '.json'    // file filter passed to the <input type=file>
 *   }
 *
 * API:
 *   getValue()        → last loaded config object (or {} before any file)
 *   setValue(obj)     → set the internal config directly (without DOM)
 *   _setStatus(msg, cls?) → update the inline status text ('ok' | 'error' | '')
 */
class ConfigUploadControl extends Control {
  constructor (controlConfig) {
    super(controlConfig)
    this.element = this._makeElement()
    this.appendHandler({
      id:   this.getID(),
      type: 'change',
      func: configUploadHandler,
    })
  }

  _makeElement () {
    const wrapper = document.createElement('div')
    wrapper.className = 'ctrl ctrl-config-upload'

    const labelEl = document.createElement('label')
    labelEl.className   = 'ctrl-label'
    labelEl.textContent = this.getLabel()
    wrapper.appendChild(labelEl)

    const row = document.createElement('div')
    row.className = 'cu-row'

    // Hidden real file input — triggered by the styled label below
    const input = document.createElement('input')
    input.type      = 'file'
    input.id        = this.getID()
    input.className = 'cu-file-input'
    input.accept    = this.config.accept || '.json'
    row.appendChild(input)

    // Visible styled button-label that activates the hidden input
    const pickBtn = document.createElement('label')
    pickBtn.className = 'cu-pick-btn'
    pickBtn.htmlFor   = this.getID()

    const icon = document.createElement('span')
    icon.className   = 'cu-icon'
    icon.textContent = '⬆'
    pickBtn.appendChild(icon)

    const pickText = document.createElement('span')
    pickText.textContent = 'Choose .json file'
    pickBtn.appendChild(pickText)

    row.appendChild(pickBtn)

    const status = document.createElement('span')
    status.className   = 'cu-status'
    status.textContent = 'No file loaded'
    row.appendChild(status)

    wrapper.appendChild(row)
    return wrapper
  }

  getValue () {
    return this.config.state
  }

  setValue (v) {
    this.config.state = (v === null || v === undefined) ? {} : v
  }

  /** Update the inline status indicator. cls: 'ok' | 'error' | '' */
  _setStatus (msg, cls) {
    const el = this.getElement().querySelector('.cu-status')
    if (!el) return
    el.textContent = msg
    el.className   = 'cu-status' + (cls ? ' ' + cls : '')
  }
}

function configUploadHandler () {
  const input   = this
  const ctrl    = globalThis.dudezilla.bindings.fetchGlobal(input.id)
  const file    = input.files && input.files[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = function (e) {
    try {
      const cfg = JSON.parse(e.target.result)
      ctrl.setValue(cfg)
      ctrl._setStatus('✓ ' + file.name, 'ok')
      ctrl.eventLinkage(cfg)
    } catch (err) {
      ctrl._setStatus('✗ Invalid JSON: ' + err.message, 'error')
    }
  }
  reader.readAsText(file)
}

ConfigUploadControl.controlType = 'config_upload'

ConfigUploadControl.meta = {
  controlType:   'config_upload',
  category:      'io',
  description:   'File picker that reads a .json file and fires eventLinkage with the parsed config. Status indicator shows success or error inline.',
  defaultConfig: {
    name:         'test_ul',
    label:        'Import Config',
    state:      {},
    control_type: 'config_upload',
    accept:       '.json',
  },
  tests: [
    {
      name: 'getValue returns initial empty object',
      fn: function (ctrl) {
        const v = ctrl.getValue()
        return v !== null && v !== undefined && typeof v === 'object'
      },
    },
    {
      name: 'setValue / getValue roundtrip',
      fn: function (ctrl) {
        ctrl.setValue({ control_type: 'page', name: 'loaded' })
        const v = ctrl.getValue()
        return v.control_type === 'page' && v.name === 'loaded'
      },
    },
    {
      name: 'setValue(null) coerces to empty object',
      fn: function (ctrl) {
        ctrl.setValue(null)
        const v = ctrl.getValue()
        return typeof v === 'object' && v !== null
      },
    },
    {
      name: 'DOM has a hidden file input',
      fn: function (ctrl) {
        const inp = ctrl.getElement().querySelector('input.cu-file-input')
        return inp !== null && inp.type === 'file'
      },
    },
    {
      name: 'file input has correct accept attribute',
      fn: function (ctrl) {
        const inp = ctrl.getElement().querySelector('input.cu-file-input')
        return inp !== null && inp.accept === '.json'
      },
    },
    {
      name: 'DOM has styled pick button',
      fn: function (ctrl) {
        return ctrl.getElement().querySelector('label.cu-pick-btn') !== null
      },
    },
    {
      name: 'DOM has status element with initial text',
      fn: function (ctrl) {
        const el = ctrl.getElement().querySelector('.cu-status')
        return el !== null && el.textContent === 'No file loaded'
      },
    },
    {
      name: '_setStatus updates text and adds class',
      fn: function (ctrl) {
        ctrl._setStatus('✓ config.json', 'ok')
        const el = ctrl.getElement().querySelector('.cu-status')
        return el.textContent === '✓ config.json' && el.classList.contains('ok')
      },
    },
    {
      name: '_setStatus error class is set correctly',
      fn: function (ctrl) {
        ctrl._setStatus('✗ Invalid JSON', 'error')
        const el = ctrl.getElement().querySelector('.cu-status')
        return el.classList.contains('error') && !el.classList.contains('ok')
      },
    },
    {
      name: 'pick button label points to file input id',
      fn: function (ctrl) {
        const btn = ctrl.getElement().querySelector('label.cu-pick-btn')
        const inp = ctrl.getElement().querySelector('input.cu-file-input')
        return btn.htmlFor === inp.id
      },
    },
  ],
}

export { ConfigUploadControl }
