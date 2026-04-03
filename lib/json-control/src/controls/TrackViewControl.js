import { Control } from '../ControlCollection.js'

/**
 * @classdesc TrackViewControl — workspace hub widget that displays the list of
 * built TrackControl configs, persists them to localStorage, exposes a
 * "+ New Track" button that embeds the track-builder wizard inline, and fires
 * eventLinkage whenever the track list changes.
 *
 * Circular-dep note: TrackViewControl does NOT import builders.js.
 * Inject the wizard factory post-construction from the host (e.g. landing.js):
 *   ctrl.config.wizardFactory = createTrackBuilderTrack
 *
 * Config:
 *   { name, label, state: [], control_type: 'track_view',
 *     storageKey?: string,          // localStorage key; default 'lz_workspace'
 *     wizardFactory?: fn }
 *
 * API:
 *   getValue()          → array of TrackControl config objects
 *   setValue(tracks)    → replace list, save, fire eventLinkage
 *   showError(msg)      → display an auto-dismissing error banner
 */
class TrackViewControl extends Control {
  constructor (controlConfig) {
    super(controlConfig)
    this._tracks     = Array.isArray(this.config.state) ? [...this.config.state] : []
    this._storageKey = this.config.storageKey || 'lz_workspace'
    this._listEl     = null
    this._wizardEl   = null
    this._countEl    = null
    this._errorEl    = null
    this._errorTimer = null
    this.element     = this._makeElement()
    this._loadFromStorage()
  }

  _makeElement () {
    const wrapper = document.createElement('div')
    wrapper.className = 'ctrl ctrl-track-view'

    // ── Header ──────────────────────────────────────────────────────────────
    const header = document.createElement('div')
    header.className = 'tv-header'

    const labelEl = document.createElement('span')
    labelEl.className   = 'ctrl-label'
    labelEl.textContent = this.getLabel()
    header.appendChild(labelEl)

    this._countEl = document.createElement('span')
    this._countEl.className = 'tv-count'
    header.appendChild(this._countEl)

    const addBtn = document.createElement('button')
    addBtn.type      = 'button'
    addBtn.className = 'tv-add-btn'
    addBtn.textContent = '+ New Track'
    addBtn.addEventListener('click', () => {
      if (this._wizardEl.hidden) {
        this._showWizard()
      } else {
        this._hideWizard()
      }
    })
    header.appendChild(addBtn)
    wrapper.appendChild(header)

    // ── Inline wizard panel ──────────────────────────────────────────────────
    this._wizardEl = document.createElement('div')
    this._wizardEl.className = 'tv-wizard'
    this._wizardEl.hidden = true
    wrapper.appendChild(this._wizardEl)

    // ── Error banner ──────────────────────────────────────────────────────────
    this._errorEl = document.createElement('p')
    this._errorEl.className = 'tv-error'
    this._errorEl.hidden = true
    wrapper.appendChild(this._errorEl)

    // ── Track list ────────────────────────────────────────────────────────────
    this._listEl = document.createElement('div')
    this._listEl.className = 'tv-list'
    wrapper.appendChild(this._listEl)

    this._renderList()
    return wrapper
  }

  getValue () {
    return this._tracks
  }

  setValue (tracks) {
    this._tracks = Array.isArray(tracks) ? [...tracks] : []
    this.config.state = this._tracks
    this._renderList()
    this._saveToStorage()
    this.eventLinkage(this._tracks)
  }

  /** Display an inline error banner that auto-dismisses after 4 s. */
  showError (msg) {
    this._errorEl.textContent = msg
    this._errorEl.hidden = false
    clearTimeout(this._errorTimer)
    this._errorTimer = setTimeout(() => { this._errorEl.hidden = true }, 4000)
  }

  // ── Internal ────────────────────────────────────────────────────────────────

  _addTrack (config) {
    var errors = []
    if (!config || typeof config !== 'object') {
      errors.push('Invalid track config')
    } else {
      if (!config.name  || !String(config.name).trim())  errors.push('Track name is required')
      if (!config.label || !String(config.label).trim()) errors.push('Track label is required')
      if (!Array.isArray(config.pages) || config.pages.length === 0) {
        errors.push('At least one page is required')
      }
    }
    if (errors.length > 0) {
      this.showError(errors.join(' \u00b7 '))
      return
    }
    this._tracks.push(config)
    this.config.state = this._tracks
    this._renderList()
    this._saveToStorage()
    this.eventLinkage(this._tracks)
    this._hideWizard()
  }

  _removeTrack (idx) {
    this._tracks.splice(idx, 1)
    this.config.state = this._tracks
    this._renderList()
    this._saveToStorage()
    this.eventLinkage(this._tracks)
  }

  _showWizard () {
    this._wizardEl.hidden   = false
    this._wizardEl.innerHTML = ''

    const hdr = document.createElement('div')
    hdr.className = 'tv-wizard-header'

    const title = document.createElement('span')
    title.className   = 'tv-wizard-title'
    title.textContent = 'Build a New Track'
    hdr.appendChild(title)

    const cancelBtn = document.createElement('button')
    cancelBtn.type      = 'button'
    cancelBtn.className = 'tv-wizard-cancel'
    cancelBtn.textContent = '\u00d7 Cancel'
    cancelBtn.addEventListener('click', () => this._hideWizard())
    hdr.appendChild(cancelBtn)

    this._wizardEl.appendChild(hdr)

    const factory = this.config.wizardFactory
    if (typeof factory !== 'function') {
      const msg = document.createElement('p')
      msg.className   = 'tv-error'
      msg.textContent = 'No track wizard factory configured.'
      this._wizardEl.appendChild(msg)
      return
    }

    const wizard = factory({
      onComplete: (cfg) => this._addTrack(cfg),
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

    if (this._tracks.length === 0) {
      const hint = document.createElement('p')
      hint.className   = 'tv-empty'
      hint.textContent = 'No tracks yet \u2014 click \u201c+ New Track\u201d to add one.'
      this._listEl.appendChild(hint)
      return
    }

    this._tracks.forEach((track, idx) => {
      const card = document.createElement('div')
      card.className = 'tv-track-card'

      const nameEl = document.createElement('span')
      nameEl.className   = 'tv-track-name'
      nameEl.textContent = track.label || track.name || 'Unnamed Track'
      card.appendChild(nameEl)

      const metaEl = document.createElement('span')
      metaEl.className = 'tv-track-meta'
      const n = Array.isArray(track.pages) ? track.pages.length : 0
      metaEl.textContent = n + ' page' + (n !== 1 ? 's' : '')
      card.appendChild(metaEl)

      const removeBtn = document.createElement('button')
      removeBtn.type      = 'button'
      removeBtn.className = 'tv-remove-btn'
      removeBtn.title     = 'Remove track'
      removeBtn.innerHTML = '&times;'
      removeBtn.addEventListener('click', () => this._removeTrack(idx))
      card.appendChild(removeBtn)

      this._listEl.appendChild(card)
    })
  }

  _updateCount () {
    if (!this._countEl) return
    const n = this._tracks.length
    this._countEl.textContent = n > 0 ? n + ' track' + (n !== 1 ? 's' : '') : ''
  }

  _loadFromStorage () {
    try {
      var stored = typeof localStorage !== 'undefined' && localStorage.getItem(this._storageKey)
      if (!stored) return
      var data = JSON.parse(stored)
      if (Array.isArray(data.tracks)) {
        this._tracks = data.tracks
        this.config.state = this._tracks
        this._renderList()
      }
    } catch (_e) {}
  }

  _saveToStorage () {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this._storageKey, JSON.stringify({ tracks: this._tracks }))
      }
    } catch (_e) {}
  }
}

TrackViewControl.controlType = 'track_view'

TrackViewControl.meta = {
  controlType:   'track_view',
  category:      'composite',
  description:   'Workspace track list with inline track-builder wizard. Persists to localStorage. wizardFactory must be injected at runtime.',
  defaultConfig: {
    name:         'tracks',
    label:        'Tracks',
    state:      [],
    control_type: 'track_view',
  },
  tests: [
    {
      name: 'getValue returns initial empty array',
      fn:   (ctrl) => Array.isArray(ctrl.getValue()) && ctrl.getValue().length === 0,
    },
    {
      name: 'setValue replaces track list',
      fn: (ctrl) => {
        ctrl.setValue([{ control_type: 'track', name: 't1', label: 'T1', pages: [] }])
        return ctrl.getValue().length === 1
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
      name: '_addTrack rejects track without pages',
      fn: (ctrl) => {
        ctrl.setValue([])
        ctrl._addTrack({ control_type: 'track', name: 't', label: 'T', pages: [] })
        return ctrl.getValue().length === 0
      },
    },
    {
      name: '_addTrack accepts valid track',
      fn: (ctrl) => {
        ctrl.setValue([])
        ctrl._addTrack({
          control_type: 'track', name: 'valid', label: 'Valid',
          pages: [{ control_type: 'page', name: 'p', label: 'P', children: [] }],
        })
        return ctrl.getValue().length === 1
      },
    },
    {
      name: '_removeTrack removes by index',
      fn: (ctrl) => {
        const page = { control_type: 'page', name: 'p', label: 'P', children: [] }
        ctrl.setValue([
          { control_type: 'track', name: 'a', label: 'A', pages: [page] },
          { control_type: 'track', name: 'b', label: 'B', pages: [page] },
        ])
        ctrl._removeTrack(0)
        return ctrl.getValue().length === 1 && ctrl.getValue()[0].name === 'b'
      },
    },
    {
      name: 'DOM has add button',
      fn: (ctrl) => ctrl.getElement().querySelector('button.tv-add-btn') !== null,
    },
    {
      name: 'DOM shows empty hint when no tracks',
      fn: (ctrl) => {
        ctrl.setValue([])
        return ctrl.getElement().querySelector('.tv-empty') !== null
      },
    },
    {
      name: 'DOM shows track cards after setValue',
      fn: (ctrl) => {
        const page = { control_type: 'page', name: 'p', label: 'P', children: [] }
        ctrl.setValue([{ control_type: 'track', name: 'x', label: 'X', pages: [page] }])
        return ctrl.getElement().querySelectorAll('.tv-track-card').length === 1
      },
    },
    {
      name: 'showError displays error message',
      fn: (ctrl) => {
        ctrl.showError('Test error')
        const el = ctrl.getElement().querySelector('.tv-error')
        return el !== null && !el.hidden && el.textContent === 'Test error'
      },
    },
  ],
}

export { TrackViewControl }
