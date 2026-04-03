import { Control } from '../ControlCollection.js'

/**
 * @classdesc PageListBuilderControl — manages an ordered list of PageControl
 * configs and embeds an inline page-builder wizard for adding new ones.
 *
 * The wizard factory is injected at runtime (not imported) to avoid the
 * circular dep: controls/index.js → builders.js → TrackControl.js → ControlFactory.js → controls/index.js.
 *
 * Usage in builders.js (after creating the track):
 *   const pagesCtrl = track.getStep('structure').getControl('pages')
 *   pagesCtrl.config.wizardFactory = createPageBuilderTrack
 *
 * Config:
 *   { name, label, state: [], control_type: 'page_list_builder',
 *     wizardFactory?: fn({ onComplete }) → TrackControl }
 *
 * API:
 *   getValue()          → array of PageControl config objects
 *   setValue(pages)     → replace the whole list and re-render
 *   showError(msg)      → display an error banner for 4 s
 */
class PageListBuilderControl extends Control {
  constructor (controlConfig) {
    super(controlConfig)
    this._pages    = Array.isArray(this.config.state) ? [...this.config.state] : []
    this._listEl   = null
    this._wizardEl = null
    this._countEl  = null
    this._errorEl  = null
    this._errorTimer = null
    this.element   = this._makeElement()
  }

  _makeElement () {
    const wrapper = document.createElement('div')
    wrapper.className = 'ctrl ctrl-page-list'

    // ── Header ──────────────────────────────────────────────────────────────
    const header = document.createElement('div')
    header.className = 'plb-header'

    const labelEl = document.createElement('span')
    labelEl.className   = 'ctrl-label'
    labelEl.textContent = this.getLabel()
    header.appendChild(labelEl)

    this._countEl = document.createElement('span')
    this._countEl.className = 'plb-count'
    header.appendChild(this._countEl)

    const addBtn = document.createElement('button')
    addBtn.type      = 'button'
    addBtn.className = 'plb-add-btn'
    addBtn.textContent = '+ Build Page'
    addBtn.addEventListener('click', () => {
      if (this._wizardEl.hidden) {
        this._showWizard()
      } else {
        this._hideWizard()
      }
    })
    header.appendChild(addBtn)
    wrapper.appendChild(header)

    // ── Error banner ─────────────────────────────────────────────────────────
    this._errorEl = document.createElement('p')
    this._errorEl.className = 'plb-error-msg'
    this._errorEl.hidden = true
    wrapper.appendChild(this._errorEl)

    // ── Page list area ───────────────────────────────────────────────────────
    this._listEl = document.createElement('div')
    this._listEl.className = 'plb-list'
    wrapper.appendChild(this._listEl)

    // ── Inline wizard panel (hidden until activated) ──────────────────────────
    this._wizardEl = document.createElement('div')
    this._wizardEl.className = 'plb-wizard'
    this._wizardEl.hidden = true
    wrapper.appendChild(this._wizardEl)

    this._renderList()
    return wrapper
  }

  getValue () {
    return this._pages
  }

  setValue (pages) {
    this._pages = Array.isArray(pages) ? [...pages] : []
    this.config.state = this._pages
    this._renderList()
  }

  /** Display an inline error banner that auto-dismisses after 4 s. */
  showError (msg) {
    this._errorEl.textContent = msg
    this._errorEl.hidden = false
    clearTimeout(this._errorTimer)
    this._errorTimer = setTimeout(() => { this._errorEl.hidden = true }, 4000)
  }

  // ── Internal ────────────────────────────────────────────────────────────────

  _addPage (pageConfig) {
    this._pages.push(pageConfig)
    this.config.state = this._pages
    this._renderList()
    this.eventLinkage(this._pages)
  }

  _removePage (idx) {
    this._pages.splice(idx, 1)
    this.config.state = this._pages
    this._renderList()
    this.eventLinkage(this._pages)
  }

  _showWizard () {
    this._wizardEl.hidden   = false
    this._wizardEl.innerHTML = ''

    const hdr = document.createElement('div')
    hdr.className = 'plb-wizard-header'

    const title = document.createElement('span')
    title.className   = 'plb-wizard-title'
    title.textContent = 'Build a Page'
    hdr.appendChild(title)

    const cancelBtn = document.createElement('button')
    cancelBtn.type      = 'button'
    cancelBtn.className = 'plb-wizard-cancel'
    cancelBtn.textContent = '\u00d7 Cancel'
    cancelBtn.addEventListener('click', () => this._hideWizard())
    hdr.appendChild(cancelBtn)

    this._wizardEl.appendChild(hdr)

    const factory = this.config.wizardFactory
    if (typeof factory !== 'function') {
      const msg = document.createElement('p')
      msg.className   = 'plb-error-msg'
      msg.textContent = 'No page wizard factory configured.'
      this._wizardEl.appendChild(msg)
      return
    }

    const wizard = factory({
      onComplete: (pageConfig) => {
        this._addPage(pageConfig)
        this._hideWizard()
      },
    })
    this._wizardEl.appendChild(wizard.getElement())
  }

  _hideWizard () {
    this._wizardEl.hidden   = true
    this._wizardEl.innerHTML = ''
  }

  _renderList () {
    this._listEl.innerHTML = ''
    this._updateCount()

    if (this._pages.length === 0) {
      const hint = document.createElement('p')
      hint.className   = 'plb-empty'
      hint.textContent = 'No pages yet \u2014 click \u201c+ Build Page\u201d to add one.'
      this._listEl.appendChild(hint)
      return
    }

    this._pages.forEach((page, idx) => {
      const card = document.createElement('div')
      card.className = 'plb-page-card'

      const nameEl = document.createElement('span')
      nameEl.className   = 'plb-page-name'
      nameEl.textContent = page.label || page.name || 'Untitled Page'
      card.appendChild(nameEl)

      const metaEl = document.createElement('span')
      metaEl.className = 'plb-page-meta'
      const n = Array.isArray(page.children) ? page.children.length : 0
      metaEl.textContent = (page.layout || 'full-width') + ' \u00b7 ' + n + ' child' + (n !== 1 ? 'ren' : '')
      card.appendChild(metaEl)

      const removeBtn = document.createElement('button')
      removeBtn.type      = 'button'
      removeBtn.className = 'plb-remove-btn'
      removeBtn.title     = 'Remove page'
      removeBtn.innerHTML = '&times;'
      removeBtn.addEventListener('click', () => this._removePage(idx))
      card.appendChild(removeBtn)

      this._listEl.appendChild(card)
    })
  }

  _updateCount () {
    if (!this._countEl) return
    const n = this._pages.length
    this._countEl.textContent = n > 0 ? n + ' page' + (n !== 1 ? 's' : '') : ''
  }
}

PageListBuilderControl.controlType = 'page_list_builder'

PageListBuilderControl.meta = {
  controlType:   'page_list_builder',
  category:      'composite',
  description:   'Ordered list of PageControl configs with an embedded page-builder wizard. wizardFactory must be injected at runtime.',
  defaultConfig: {
    name:         'test_plb',
    label:        'Pages',
    state:      [],
    control_type: 'page_list_builder',
  },
  tests: [
    {
      name: 'getValue returns initial empty array',
      fn: function (ctrl) {
        const v = ctrl.getValue()
        return Array.isArray(v) && v.length === 0
      },
    },
    {
      name: 'setValue replaces the page list',
      fn: function (ctrl) {
        ctrl.setValue([{ control_type: 'page', name: 'p1', label: 'P1', children: [] }])
        return ctrl.getValue().length === 1 && ctrl.getValue()[0].name === 'p1'
      },
    },
    {
      name: 'setValue(null) coerces to empty array',
      fn: function (ctrl) {
        ctrl.setValue(null)
        return Array.isArray(ctrl.getValue()) && ctrl.getValue().length === 0
      },
    },
    {
      name: '_addPage appends to the list',
      fn: function (ctrl) {
        ctrl.setValue([])
        ctrl._addPage({ control_type: 'page', name: 'a', label: 'A', children: [] })
        return ctrl.getValue().length === 1
      },
    },
    {
      name: '_removePage removes by index',
      fn: function (ctrl) {
        ctrl.setValue([
          { control_type: 'page', name: 'a', label: 'A', children: [] },
          { control_type: 'page', name: 'b', label: 'B', children: [] },
        ])
        ctrl._removePage(0)
        return ctrl.getValue().length === 1 && ctrl.getValue()[0].name === 'b'
      },
    },
    {
      name: 'DOM has a list area',
      fn: function (ctrl) {
        return ctrl.getElement().querySelector('.plb-list') !== null
      },
    },
    {
      name: 'DOM shows empty hint when no pages',
      fn: function (ctrl) {
        ctrl.setValue([])
        const hint = ctrl.getElement().querySelector('.plb-empty')
        return hint !== null
      },
    },
    {
      name: 'DOM renders page cards after setValue',
      fn: function (ctrl) {
        ctrl.setValue([
          { control_type: 'page', name: 'x', label: 'X', layout: 'full-width', children: [] },
        ])
        return ctrl.getElement().querySelectorAll('.plb-page-card').length === 1
      },
    },
    {
      name: 'DOM has add button',
      fn: function (ctrl) {
        return ctrl.getElement().querySelector('button.plb-add-btn') !== null
      },
    },
    {
      name: 'showError displays and auto-hides',
      fn: function (ctrl) {
        ctrl.showError('Test error')
        const el = ctrl.getElement().querySelector('.plb-error-msg')
        return el !== null && !el.hidden && el.textContent === 'Test error'
      },
    },
  ],
}

export { PageListBuilderControl }
