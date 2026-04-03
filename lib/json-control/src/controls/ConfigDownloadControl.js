import { Control } from '../ControlCollection.js'

/**
 * @classdesc ConfigDownloadControl — a button that downloads its current value
 * as a pretty-printed JSON file.
 *
 * Typical usage:
 *   downloadCtrl.setValue(pageCtrl.getSnapshot())
 *   // user clicks → browser saves "<name>.json"
 *
 * Config:
 *   { name, label, state: {}, control_type: 'config_download',
 *     filename?: 'my_config.json',   // optional explicit filename
 *     btnLabel?: 'Download Config'   // optional button text
 *   }
 */
class ConfigDownloadControl extends Control {
  constructor (controlConfig) {
    super(controlConfig)
    this.element = this._makeElement()
    this.appendHandler({
      id:   this.getID(),
      type: 'click',
      func: configDownloadHandler,
    })
  }

  _makeElement () {
    const wrapper = document.createElement('div')
    wrapper.className = 'ctrl ctrl-config-download'

    const label = document.createElement('label')
    label.className   = 'ctrl-label'
    label.textContent = this.getLabel()
    wrapper.appendChild(label)

    const row = document.createElement('div')
    row.className = 'cd-row'

    const btn = document.createElement('button')
    btn.type      = 'button'
    btn.id        = this.getID()
    btn.className = 'cd-btn'

    const icon = document.createElement('span')
    icon.className   = 'cd-icon'
    icon.textContent = '⬇'
    btn.appendChild(icon)

    const btnText = document.createElement('span')
    btnText.className   = 'cd-btn-text'
    btnText.textContent = this.config.btnLabel || 'Download Config'
    btn.appendChild(btnText)

    row.appendChild(btn)

    const hint = document.createElement('span')
    hint.className   = 'cd-hint'
    hint.textContent = this._filename()
    row.appendChild(hint)

    wrapper.appendChild(row)
    return wrapper
  }

  getValue () {
    return this.config.state
  }

  setValue (v) {
    this.config.state = (v === null || v === undefined) ? {} : v
  }

  /** Resolved filename — uses config.filename or falls back to name + '.json'. */
  _filename () {
    return this.config.filename || (this.getName() + '.json')
  }

  /**
   * Trigger a browser file download of the current value.
   * No-op in environments without URL.createObjectURL (e.g. jsdom in tests).
   */
  _download () {
    const json = JSON.stringify(this.getValue(), null, 2)

    // URL.createObjectURL is not available in jsdom / Node — guard for tests
    if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return

    const blob = new Blob([json], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = this._filename()
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }
}

function configDownloadHandler () {
  const ctrl = globalThis.dudezilla.bindings.fetchGlobal(this.id)
  ctrl._download()
}

ConfigDownloadControl.controlType = 'config_download'

ConfigDownloadControl.meta = {
  controlType:   'config_download',
  category:      'io',
  description:   'Button that serializes config.state to JSON and downloads it as a file. Call setValue(obj) to set what gets downloaded.',
  defaultConfig: {
    name:         'test_dl',
    label:        'Export Config',
    state:      {},
    control_type: 'config_download',
    btnLabel:     'Download Config',
    filename:     'config.json',
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
        ctrl.setValue({ control_type: 'page', name: 'my_page' })
        const v = ctrl.getValue()
        return v.control_type === 'page' && v.name === 'my_page'
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
      name: 'DOM has a download button',
      fn: function (ctrl) {
        return ctrl.getElement().querySelector('button.cd-btn') !== null
      },
    },
    {
      name: 'DOM button contains the download icon',
      fn: function (ctrl) {
        const icon = ctrl.getElement().querySelector('.cd-icon')
        return icon !== null && icon.textContent === '⬇'
      },
    },
    {
      name: 'DOM shows filename hint',
      fn: function (ctrl) {
        const hint = ctrl.getElement().querySelector('.cd-hint')
        return hint !== null && hint.textContent === 'config.json'
      },
    },
    {
      name: '_download() does not throw in test environment',
      fn: function (ctrl) {
        try { ctrl._download(); return true } catch (_) { return false }
      },
    },
    {
      name: '_filename() uses config.filename when provided',
      fn: function (ctrl) {
        return ctrl._filename() === 'config.json'
      },
    },
    {
      name: '_filename() falls back to name + .json when no filename in config',
      fn: function (ctrl) {
        const saved = ctrl.config.filename
        delete ctrl.config.filename
        const result = ctrl._filename() === ctrl.getName() + '.json'
        ctrl.config.filename = saved
        return result
      },
    },
  ],
}

export { ConfigDownloadControl }
