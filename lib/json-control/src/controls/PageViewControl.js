import { Control } from '../ControlCollection.js'

/**
 * @classdesc PageViewControl — read-only display of a list of PageControl
 * configs. Typically fed by the host (e.g. landing.js) whenever the track
 * list changes, so users can see all pages across all tracks at a glance.
 *
 * Config:
 *   { name, label, state: [], control_type: 'page_view' }
 *
 * API:
 *   getValue()      → array of page config objects currently displayed
 *   setValue(pages) → replace page list and re-render (does NOT fire eventLinkage)
 */
class PageViewControl extends Control {
  constructor (controlConfig) {
    super(controlConfig)
    this._pages  = Array.isArray(this.config.state) ? [...this.config.state] : []
    this._listEl = null
    this._countEl = null
    this.element = this._makeElement()
  }

  _makeElement () {
    const wrapper = document.createElement('div')
    wrapper.className = 'ctrl ctrl-page-view'

    // ── Header ──────────────────────────────────────────────────────────────
    const header = document.createElement('div')
    header.className = 'pv-header'

    const labelEl = document.createElement('span')
    labelEl.className   = 'ctrl-label'
    labelEl.textContent = this.getLabel()
    header.appendChild(labelEl)

    this._countEl = document.createElement('span')
    this._countEl.className = 'pv-count'
    header.appendChild(this._countEl)

    wrapper.appendChild(header)

    // ── Page list ────────────────────────────────────────────────────────────
    this._listEl = document.createElement('div')
    this._listEl.className = 'pv-list'
    wrapper.appendChild(this._listEl)

    this._renderList()
    return wrapper
  }

  getValue () {
    return this._pages
  }

  /**
   * Replace the displayed pages.
   * Intentionally does NOT fire eventLinkage to avoid feedback loops when
   * updated from a host onAnyChange handler.
   */
  setValue (pages) {
    this._pages = Array.isArray(pages) ? [...pages] : []
    this.config.state = this._pages
    this._renderList()
  }

  // ── Internal ────────────────────────────────────────────────────────────────

  _renderList () {
    this._listEl.innerHTML = ''
    this._updateCount()

    if (this._pages.length === 0) {
      const hint = document.createElement('p')
      hint.className   = 'pv-empty'
      hint.textContent = 'No pages yet \u2014 add a track with at least one page to see them here.'
      this._listEl.appendChild(hint)
      return
    }

    this._pages.forEach((page) => {
      const card = document.createElement('div')
      card.className = 'pv-page-card'

      const nameEl = document.createElement('span')
      nameEl.className   = 'pv-page-name'
      nameEl.textContent = page.label || page.name || 'Untitled Page'
      card.appendChild(nameEl)

      const metaEl = document.createElement('span')
      metaEl.className = 'pv-page-meta'
      const n = Array.isArray(page.children) ? page.children.length : 0
      metaEl.textContent = (page.layout || 'full-width') + ' \u00b7 ' + n + ' field' + (n !== 1 ? 's' : '')
      card.appendChild(metaEl)

      if (page._trackLabel) {
        const trackEl = document.createElement('span')
        trackEl.className   = 'pv-page-track'
        trackEl.textContent = page._trackLabel
        card.appendChild(trackEl)
      }

      this._listEl.appendChild(card)
    })
  }

  _updateCount () {
    if (!this._countEl) return
    const n = this._pages.length
    this._countEl.textContent = n > 0 ? n + ' page' + (n !== 1 ? 's' : '') : ''
  }
}

PageViewControl.controlType = 'page_view'

PageViewControl.meta = {
  controlType:   'page_view',
  category:      'composite',
  description:   'Read-only display of PageControl configs. Call setValue(pages) to update. Does not fire eventLinkage on setValue.',
  defaultConfig: {
    name:         'pages',
    label:        'Pages',
    state:      [],
    control_type: 'page_view',
  },
  tests: [
    {
      name: 'getValue returns initial empty array',
      fn:   (ctrl) => Array.isArray(ctrl.getValue()) && ctrl.getValue().length === 0,
    },
    {
      name: 'setValue replaces page list',
      fn: (ctrl) => {
        ctrl.setValue([{ control_type: 'page', name: 'p1', label: 'P1', children: [] }])
        return ctrl.getValue().length === 1 && ctrl.getValue()[0].name === 'p1'
      },
    },
    {
      name: 'setValue(null) coerces to empty array',
      fn: (ctrl) => {
        ctrl.setValue(null)
        return Array.isArray(ctrl.getValue()) && ctrl.getValue().length === 0
      },
    },
    {
      name: 'DOM has list area',
      fn: (ctrl) => ctrl.getElement().querySelector('.pv-list') !== null,
    },
    {
      name: 'DOM shows empty hint when no pages',
      fn: (ctrl) => {
        ctrl.setValue([])
        return ctrl.getElement().querySelector('.pv-empty') !== null
      },
    },
    {
      name: 'DOM renders page cards after setValue',
      fn: (ctrl) => {
        ctrl.setValue([
          { control_type: 'page', name: 'x', label: 'X', layout: 'full-width', children: [] },
        ])
        return ctrl.getElement().querySelectorAll('.pv-page-card').length === 1
      },
    },
    {
      name: 'DOM shows correct child count in meta',
      fn: (ctrl) => {
        ctrl.setValue([{
          control_type: 'page', name: 'x', label: 'X', layout: 'full-width',
          children: [
            { name: 'a', control_type: 'boolean', state: true },
            { name: 'b', control_type: 'boolean', state: false },
          ],
        }])
        const meta = ctrl.getElement().querySelector('.pv-page-meta')
        return meta !== null && meta.textContent.includes('2 fields')
      },
    },
  ],
}

export { PageViewControl }
