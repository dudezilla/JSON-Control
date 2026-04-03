import { Control } from '../ControlCollection.js'

var FILTER_LEVELS = ['ALL', 'DEBUG', 'MESSAGE', 'WARNING', 'CRITICAL']

class LogViewerControl extends Control {
  constructor (controlConfig) {
    super(controlConfig)
    this._activeFilter = 'ALL'
    this._filterBtns   = {}
    this._list         = null
    this._status       = null
    this.element       = this.makeElement()
  }

  // ── Value helpers ──────────────────────────────────────────────────────────

  _entries () {
    try {
      var v = this.getValue()
      if (Array.isArray(v)) return v
      if (typeof v === 'string' && v.trim()) return JSON.parse(v)
      return []
    } catch (_) {
      return []
    }
  }

  _filtered () {
    var entries = this._entries()
    var filter  = this._activeFilter
    if (filter === 'ALL') return entries
    return entries.filter(function (e) {
      return (e.level || '').toUpperCase() === filter
    })
  }

  // ── DOM builders ───────────────────────────────────────────────────────────

  makeElement () {
    var cfg    = this.getConfig()
    var height = cfg.height || '260px'
    var self   = this

    var wrapper    = document.createElement('div')
    wrapper.id     = this.getID()
    wrapper.className = 'lv-wrapper'

    // ── Header ───────────────────────────────────────────────────────────────
    var header       = document.createElement('div')
    header.className = 'lv-header'

    var title       = document.createElement('span')
    title.className = 'lv-title'
    title.textContent = this.getLabel() || 'Logs'
    header.appendChild(title)

    // Level filter buttons
    FILTER_LEVELS.forEach(function (lvl) {
      var btn           = document.createElement('button')
      btn.type          = 'button'
      btn.textContent   = lvl
      btn.dataset.level = lvl
      btn.className     = 'lv-filter-btn'
      btn.addEventListener('click', function () {
        self._activeFilter = lvl
        self._updateFilterStyle()
        self._renderRows()
      })
      self._filterBtns[lvl] = btn
      header.appendChild(btn)
    })
    wrapper.appendChild(header)

    // ── Log list ──────────────────────────────────────────────────────────────
    var list       = document.createElement('div')
    list.className = 'lv-list'
    list.style.height = height
    this._list = list
    wrapper.appendChild(list)

    // ── Status bar ────────────────────────────────────────────────────────────
    var status       = document.createElement('div')
    status.className = 'lv-status'
    this._status = status
    wrapper.appendChild(status)

    this._updateFilterStyle()
    this._renderRows()
    return wrapper
  }

  _updateFilterStyle () {
    var active = this._activeFilter
    var btns   = this._filterBtns
    FILTER_LEVELS.forEach(function (lvl) {
      var btn = btns[lvl]
      if (!btn) return
      if (lvl === active) {
        btn.classList.add('active')
      } else {
        btn.classList.remove('active')
      }
    })
  }

  _renderRows () {
    if (!this._list) return
    var cfg     = this.getConfig()
    var max     = cfg.maxEntries || 100
    var entries = this._filtered()
    var visible = entries.slice(-max)
    var self    = this

    this._list.innerHTML = ''

    if (visible.length === 0) {
      var empty       = document.createElement('div')
      empty.className = 'lv-empty'
      empty.textContent = 'No log entries' + (this._activeFilter !== 'ALL' ? ' at level ' + this._activeFilter : '') + '.'
      this._list.appendChild(empty)
    } else {
      visible.forEach(function (entry) {
        self._list.appendChild(self._makeRow(entry))
      })
    }

    if (this._status) {
      var total = this._entries().length
      var shown = visible.length
      this._status.textContent = shown === total
        ? total + (total === 1 ? ' entry' : ' entries')
        : shown + ' of ' + total + ' \u2014 filter: ' + this._activeFilter
    }

    if (cfg.autoScroll !== false) {
      this._list.scrollTop = this._list.scrollHeight
    }
  }

  _makeRow (entry) {
    var level = (entry.level || 'MESSAGE').toUpperCase()

    var row       = document.createElement('div')
    row.className = 'lv-row'

    // Level badge — data-level drives CSS colour rules
    var badge           = document.createElement('span')
    badge.className     = 'lv-badge'
    badge.dataset.level = level
    badge.textContent   = level
    row.appendChild(badge)

    // Timestamp
    var time       = document.createElement('span')
    time.className = 'lv-time'
    var ts = entry.logged_at || ''
    time.textContent = ts ? ts.replace('T', ' ').replace(/\.\d+Z?$/, '') : ''
    time.title = ts
    row.appendChild(time)

    // Context
    var ctx       = document.createElement('span')
    ctx.className = 'lv-ctx'
    ctx.textContent = entry.context || ''
    row.appendChild(ctx)

    // Message + expandable detail
    var msgWrap = document.createElement('div')

    var msg       = document.createElement('span')
    msg.className = 'lv-msg'
    msg.textContent = entry.message || ''
    msgWrap.appendChild(msg)

    if (entry.detail) {
      var detail       = document.createElement('pre')
      detail.className = 'lv-detail'
      try {
        var d = entry.detail
        detail.textContent = typeof d === 'string'
          ? JSON.stringify(JSON.parse(d), null, 2)
          : JSON.stringify(d, null, 2)
      } catch (_) {
        detail.textContent = String(entry.detail)
      }
      msgWrap.appendChild(detail)
      row.addEventListener('click', function () {
        detail.classList.toggle('visible')
      })

      var arrow       = document.createElement('span')
      arrow.className = 'lv-arrow'
      arrow.textContent = '\u25bc'
      msg.appendChild(arrow)
    }

    row.appendChild(msgWrap)
    return row
  }

  // ── Control API ────────────────────────────────────────────────────────────

  updateView () {
    this._renderRows()
  }
}

LogViewerControl.controlType = 'log_viewer'

LogViewerControl.meta = {
  controlType:   'log_viewer',
  category:      'debug',
  description:   'Renders a scrollable log panel with level badges (DEBUG/MESSAGE/WARNING/CRITICAL), timestamp, context, message, and expandable detail. Filter buttons narrow the visible entries by level.',
  defaultConfig: {
    name:        'test_logs',
    label:       'Test Logs',
    state:     JSON.stringify([
      { level: 'MESSAGE',  logged_at: '2026-01-01T00:00:00Z', context: 'init',  message: 'started' },
      { level: 'WARNING',  logged_at: '2026-01-01T00:01:00Z', context: 'boot',  message: 'slow start' },
      { level: 'CRITICAL', logged_at: '2026-01-01T00:02:00Z', context: 'crash', message: 'boom', detail: { code: 500 } },
    ]),
    control_type: 'log_viewer',
    height:       '200px',
  },
  tests: [
    {
      name: 'getValue returns the initial JSON string',
      fn: function (ctrl) {
        var v = ctrl.getValue()
        return typeof v === 'string' && v.includes('started')
      }
    },
    {
      name: '_entries() parses JSON value into an array',
      fn: function (ctrl) {
        return Array.isArray(ctrl._entries()) && ctrl._entries().length === 3
      }
    },
    {
      name: '_filtered() with ALL returns every entry',
      fn: function (ctrl) {
        ctrl._activeFilter = 'ALL'
        return ctrl._filtered().length === 3
      }
    },
    {
      name: '_filtered() with WARNING returns only WARNING entries',
      fn: function (ctrl) {
        ctrl._activeFilter = 'WARNING'
        return ctrl._filtered().length === 1 && ctrl._filtered()[0].message === 'slow start'
      }
    },
    {
      name: 'buildSubControls returns a DOM element',
      fn: function (ctrl) { var el = ctrl.getElement(); return !!el && el.nodeType === 1 }
    },
    {
      name: 'DOM contains a filter button for each level',
      fn: function (ctrl) {
        var btns = Object.keys(ctrl._filterBtns)
        return ['ALL', 'DEBUG', 'MESSAGE', 'WARNING', 'CRITICAL'].every(function (l) { return btns.includes(l) })
      }
    },
    {
      name: 'setValue then _entries() reflects new data',
      fn: function (ctrl) {
        ctrl.setValue(JSON.stringify([{ level: 'DEBUG', message: 'hi', logged_at: '', context: '' }]))
        return ctrl._entries().length === 1 && ctrl._entries()[0].message === 'hi'
      }
    },
  ]
}

export { LogViewerControl }
