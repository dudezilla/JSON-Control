import { Control } from '../ControlCollection.js'

/**
 * @classdesc ListBuilderControl — a dynamic table of rows, each row being a
 * set of fields defined by config.fields.
 *
 * The user can add rows (up to config.maxRows), fill in fields per row,
 * and remove rows.  getValue() returns the current rows as an array of plain
 * objects, keyed by field name.
 *
 * Field descriptors in config.fields:
 *   { name: string, label: string, type: 'text' | 'select', placeholder?: string,
 *     options?: string[], width?: string }
 *
 * config.maxRows   (default 20) — caps the add button
 * config.addLabel  (default '+ Add') — text on the add button
 * config.emptyHint (default 'No rows yet. Click + Add to begin.') — empty state
 *
 * Config:
 * {
 *   name: 'controls_list', label: 'Controls', state: [],
 *   control_type: 'list_builder', maxRows: 10,
 *   fields: [
 *     { name: 'name',    label: 'Name',    type: 'text',   placeholder: 'field_name' },
 *     { name: 'label',   label: 'Label',   type: 'text',   placeholder: 'Display Label' },
 *     { name: 'type',    label: 'Type',    type: 'select',
 *       options: ['boolean', 'text_input', 'radio', 'selection'] },
 *     { name: 'default', label: 'Default', type: 'text',   placeholder: '' },
 *     { name: 'zone',    label: 'Zone',    type: 'text',   placeholder: 'main' },
 *   ]
 * }
 */
class ListBuilderControl extends Control {
  constructor (controlConfig) {
    super(controlConfig)
    this.element = this._makeElement()

    // Pre-populate from config.state
    if (Array.isArray(this.config.state) && this.config.state.length > 0) {
      this.setValue(this.config.state)
    }

    // Three delegated handlers on the container element:
    // click  → add/remove row buttons
    // input  → text field changes
    // change → select changes
    this.appendHandler({ id: this.getID(), type: 'click',  func: listBuilderClickHandler  })
    this.appendHandler({ id: this.getID(), type: 'input',  func: listBuilderInputHandler  })
    this.appendHandler({ id: this.getID(), type: 'change', func: listBuilderInputHandler  })
  }

  // ── DOM construction ──────────────────────────────────────────────────────

  _makeElement () {
    const fields  = this.config.fields   || []
    const maxRows = this.config.maxRows  || 20
    const addLbl  = this.config.addLabel || '+ Add'

    const wrapper = document.createElement('div')
    wrapper.id        = this.getID()    // container ID used by event delegation
    wrapper.className = 'ctrl ctrl-list-builder'

    // ── Header ──
    const header = document.createElement('div')
    header.className = 'lb-header'

    const lbl = document.createElement('span')
    lbl.className   = 'ctrl-label'
    lbl.textContent = this.getLabel()
    header.appendChild(lbl)

    const addBtn = document.createElement('button')
    addBtn.type          = 'button'
    addBtn.className     = 'lb-add-btn'
    addBtn.dataset.action = 'add'
    addBtn.textContent   = addLbl
    addBtn.disabled      = (maxRows === 0)
    header.appendChild(addBtn)
    wrapper.appendChild(header)

    // ── Table ──
    const table = document.createElement('div')
    table.className = 'lb-table'

    // Column headers
    const colHeaders = document.createElement('div')
    colHeaders.className = 'lb-col-headers'
    for (const field of fields) {
      const ch = document.createElement('span')
      ch.className   = 'lb-col-header'
      ch.textContent = field.label || field.name
      if (field.width) ch.style.width = field.width
      colHeaders.appendChild(ch)
    }
    // Extra header cell for remove button column
    const rmHeader = document.createElement('span')
    rmHeader.className = 'lb-col-header lb-col-remove'
    colHeaders.appendChild(rmHeader)
    table.appendChild(colHeaders)

    // Rows container
    const rowsEl = document.createElement('div')
    rowsEl.className = 'lb-rows'
    table.appendChild(rowsEl)

    // Empty hint (shown when no rows)
    const hint = document.createElement('div')
    hint.className   = 'lb-empty-hint'
    hint.textContent = this.config.emptyHint || 'No rows yet — click + Add to begin.'
    table.appendChild(hint)

    wrapper.appendChild(table)
    return wrapper
  }

  // ── Row factory ───────────────────────────────────────────────────────────

  _makeRow (data) {
    data = data || {}
    const fields = this.config.fields || []
    const row    = document.createElement('div')
    row.className = 'lb-row'

    for (const field of fields) {
      let cell

      if (field.type === 'select') {
        cell = document.createElement('select')
        cell.className    = 'lb-cell'
        cell.dataset.field = field.name
        for (const opt of (field.options || [])) {
          const o = document.createElement('option')
          o.value       = opt
          o.textContent = opt
          if (String(data[field.name]) === opt) o.selected = true
          cell.appendChild(o)
        }
      } else {
        cell = document.createElement('input')
        cell.type          = 'text'
        cell.className     = 'lb-cell'
        cell.dataset.field = field.name
        cell.placeholder   = field.placeholder || ''
        cell.value         = data[field.name] !== undefined ? String(data[field.name]) : ''
      }

      if (field.width) cell.style.width = field.width
      row.appendChild(cell)
    }

    // Remove button
    const rm = document.createElement('button')
    rm.type          = 'button'
    rm.className     = 'lb-remove-btn'
    rm.dataset.action = 'remove'
    rm.textContent   = '✕'
    rm.title         = 'Remove row'
    row.appendChild(rm)

    return row
  }

  // ── Imperative helpers ────────────────────────────────────────────────────

  /** Add a blank row (or a row pre-filled from `data`). Respects maxRows. */
  _addRow (data) {
    const rowsEl = this.getElement().querySelector('.lb-rows')
    if (!rowsEl) return
    const maxRows = this.config.maxRows || 20
    if (rowsEl.querySelectorAll('.lb-row').length >= maxRows) return

    // Build empty data from field defaults
    const emptyData = {}
    for (const field of (this.config.fields || [])) {
      emptyData[field.name] = (field.type === 'select')
        ? ((field.options || [])[0] || '')
        : ''
    }
    rowsEl.appendChild(this._makeRow(data || emptyData))
    this._updateAddButton()
    this._updateEmptyHint()
  }

  /** Sync add-button disabled state against maxRows. */
  _updateAddButton () {
    const addBtn = this.getElement().querySelector('.lb-add-btn')
    const rowsEl = this.getElement().querySelector('.lb-rows')
    if (!addBtn || !rowsEl) return
    const maxRows = this.config.maxRows || 20
    addBtn.disabled = rowsEl.querySelectorAll('.lb-row').length >= maxRows
  }

  /** Toggle the empty-state hint. */
  _updateEmptyHint () {
    const hint   = this.getElement().querySelector('.lb-empty-hint')
    const rowsEl = this.getElement().querySelector('.lb-rows')
    if (!hint || !rowsEl) return
    const hasRows = rowsEl.querySelectorAll('.lb-row').length > 0
    hint.style.display = hasRows ? 'none' : ''
  }

  // ── Control API ───────────────────────────────────────────────────────────

  /**
   * Returns the current row data as an array of plain objects.
   * Reads directly from DOM so it's always in sync with user edits.
   * @returns {Object[]}
   */
  getValue () {
    const result = []
    const rowEls = this.getElement().querySelectorAll('.lb-row')
    for (const rowEl of rowEls) {
      const rowData = {}
      const cells   = rowEl.querySelectorAll('[data-field]')
      for (const cell of cells) {
        rowData[cell.dataset.field] = cell.value
      }
      result.push(rowData)
    }
    return result
  }

  /**
   * Replace all rows with the given array of plain objects.
   * @param {Object[]} arr
   */
  setValue (arr) {
    if (!Array.isArray(arr)) return
    const rowsEl = this.getElement().querySelector('.lb-rows')
    if (!rowsEl) return
    while (rowsEl.firstChild) rowsEl.removeChild(rowsEl.firstChild)
    for (const rowData of arr) {
      rowsEl.appendChild(this._makeRow(rowData))
    }
    this._updateAddButton()
    this._updateEmptyHint()
  }
}

// ── Event handlers ────────────────────────────────────────────────────────────
// These are delegated on the container (.ctrl-list-builder#ctrlID).
// 'this' = the container element; 'event.target' = the actual clicked/changed element.

function listBuilderClickHandler (event) {
  const target  = event.target
  const control = globalThis.dudezilla.bindings.fetchGlobal(this.id)

  // Add button
  if (target.dataset.action === 'add') {
    control._addRow()
    control.eventLinkage(control.getValue())
    return
  }

  // Remove button — or a child element inside the button
  const removeBtn = target.closest ? target.closest('[data-action=remove]') : null
  if (removeBtn) {
    const rowEl = removeBtn.closest('.lb-row')
    if (rowEl && rowEl.parentNode) {
      rowEl.parentNode.removeChild(rowEl)
      control._updateAddButton()
      control._updateEmptyHint()
      control.eventLinkage(control.getValue())
    }
  }
}

function listBuilderInputHandler (event) {
  const control = globalThis.dudezilla.bindings.fetchGlobal(this.id)
  control.eventLinkage(control.getValue())
}

ListBuilderControl.controlType = 'list_builder'

ListBuilderControl.meta = {
  controlType:   'list_builder',
  category:      'composite',
  description:   'Dynamic table of rows. Each row is a set of typed fields (text / select) defined by config.fields. Users add/remove rows; getValue() returns the current rows as an array of plain objects. Designed to build children[] arrays for PageControl and CompositeControl configs.',
  defaultConfig: {
    name:         'test_list',
    label:        'Field Definitions',
    state:      [],
    control_type: 'list_builder',
    maxRows:      5,
    fields: [
      { name: 'name',    label: 'Name',    type: 'text',   placeholder: 'field_name' },
      { name: 'label',   label: 'Label',   type: 'text',   placeholder: 'Display Label' },
      { name: 'type',    label: 'Type',    type: 'select',
        options: ['boolean', 'text_input', 'radio', 'selection'] },
      { name: 'zone',    label: 'Zone',    type: 'text',   placeholder: 'main' },
    ]
  },
  tests: [
    {
      name: 'getValue returns empty array initially',
      fn: function (ctrl) {
        var v = ctrl.getValue()
        return Array.isArray(v) && v.length === 0
      }
    },
    {
      name: '_addRow adds one row',
      fn: function (ctrl) {
        ctrl._addRow()
        return ctrl.getValue().length === 1
      }
    },
    {
      name: '_addRow adds a second row',
      fn: function (ctrl) {
        ctrl._addRow()
        return ctrl.getValue().length === 2
      }
    },
    {
      name: '_addRow respects maxRows',
      fn: function (ctrl) {
        // Reset to 0 rows then fill to max
        ctrl.setValue([])
        for (var i = 0; i < 10; i++) ctrl._addRow()  // maxRows = 5
        return ctrl.getValue().length === 5
      }
    },
    {
      name: 'setValue replaces rows with supplied data',
      fn: function (ctrl) {
        ctrl.setValue([
          { name: 'enabled', label: 'Enabled', type: 'boolean', zone: 'main' },
          { name: 'verbose', label: 'Verbose', type: 'boolean', zone: 'main' },
        ])
        var v = ctrl.getValue()
        return v.length === 2 && v[0].name === 'enabled' && v[1].name === 'verbose'
      }
    },
    {
      name: 'setValue then getValue roundtrip preserves field values',
      fn: function (ctrl) {
        ctrl.setValue([{ name: 'alpha', label: 'Alpha', type: 'text_input', zone: 'sidebar' }])
        var v = ctrl.getValue()
        return v[0].name === 'alpha' && v[0].zone === 'sidebar'
      }
    },
    {
      name: 'setValue([]) clears all rows',
      fn: function (ctrl) {
        ctrl.setValue([{ name: 'a', label: 'A', type: 'boolean', zone: 'main' }])
        ctrl.setValue([])
        return ctrl.getValue().length === 0
      }
    },
    {
      name: 'buildSubControls returns a DOM element',
      fn: function (ctrl) { var el = ctrl.getElement(); return !!el && el.nodeType === 1 }
    },
    {
      name: 'DOM root has ctrl-list-builder class',
      fn: function (ctrl) { return ctrl.getElement().classList.contains('ctrl-list-builder') }
    },
    {
      name: 'DOM has .lb-add-btn button',
      fn: function (ctrl) { return ctrl.getElement().querySelector('.lb-add-btn') !== null }
    },
    {
      name: 'DOM has .lb-rows container',
      fn: function (ctrl) { return ctrl.getElement().querySelector('.lb-rows') !== null }
    },
    {
      name: 'DOM has column headers matching field count + 1 (remove col)',
      fn: function (ctrl) {
        var headers = ctrl.getElement().querySelectorAll('.lb-col-header')
        return headers.length === ctrl.config.fields.length + 1
      }
    },
    {
      name: 'container element id matches getID() (needed for event delegation)',
      fn: function (ctrl) { return ctrl.getElement().id === ctrl.getID() }
    },
    {
      name: 'add-button is disabled when at maxRows',
      fn: function (ctrl) {
        ctrl.setValue([])
        for (var i = 0; i < 5; i++) ctrl._addRow()
        var btn = ctrl.getElement().querySelector('.lb-add-btn')
        return btn !== null && btn.disabled === true
      }
    },
    {
      name: 'add-button is enabled when below maxRows',
      fn: function (ctrl) {
        ctrl.setValue([])
        var btn = ctrl.getElement().querySelector('.lb-add-btn')
        return btn !== null && btn.disabled === false
      }
    },
  ]
}

export { ListBuilderControl }
