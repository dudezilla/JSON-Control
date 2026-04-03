/**
 * @module builders
 *
 * Factory functions that create pre-wired TrackControl instances whose purpose
 * is to *produce* other control configs rather than collect user data.
 *
 * Two builders are exported:
 *
 *   createPageBuilderTrack({ rootID?, onComplete? })
 *     A 3-step wizard that outputs a valid PageControl config.
 *     Steps: identity → children (list_builder) → preview (collapsible JSON)
 *
 *   createTrackBuilderTrack({ rootID?, onComplete? })
 *     A 3-step wizard that outputs a valid TrackControl config.
 *     Steps: identity → structure (flat list_builder with page/field rows) → preview
 *
 * Transform functions are also exported for use outside the wizards:
 *
 *   buildPageConfig(snapshot)  → PageControl config object
 *   buildTrackConfig(snapshot) → TrackControl config object
 *
 * Usage:
 *
 *   import { createPageBuilderTrack } from '/src/builders.js'
 *
 *   createPageBuilderTrack({
 *     onComplete: (pageConfig) => PageControl.fromConfig(pageConfig).mount(document.body)
 *   }).mount(document.querySelector('#wizard'))
 */

import { TrackControl } from './controls/TrackControl.js'

// ── Default coercion ──────────────────────────────────────────────────────────

/**
 * Convert a row's text "default" value to the appropriate JS primitive for
 * the given control_type.
 * @param {string} val   Raw string from the list_builder cell
 * @param {string} type  control_type string
 * @returns {*}
 */
export function parseDefault (val, type) {
  if (val === undefined || val === null || val === '') {
    if (type === 'boolean')    return false
    if (type === 'text_input') return 'Sample text'
    return 'N/A'
  }
  if (val === 'true')  return true
  if (val === 'false') return false
  return val
}

// ── Transform: snapshot → PageControl config ──────────────────────────────────

/**
 * Convert a page-builder track snapshot into a ready-to-use PageControl config.
 *
 * Expected snapshot shape (from createPageBuilderTrack().getFullSnapshot()):
 * {
 *   identity: { name, label, description, layout },
 *   children: { fields: [ { name, label, type, default, zone }, … ] },
 *   preview:  { config_json }
 * }
 *
 * @param {Object} snap  getFullSnapshot() result from createPageBuilderTrack()
 * @returns {Object}     PageControl config
 */
export function buildPageConfig (snap) {
  const id   = snap.identity || {}
  const rows = Array.isArray((snap.children || {}).fields)
    ? snap.children.fields
    : []

  return {
    name:         id.name        || 'my_page',
    label:        id.label       || 'My Page',
    description:  id.description || '',
    state:      {},
    control_type: 'page',
    layout:       id.layout      || 'full-width',
    children:     rows
      .filter(function (r) { return r && r.name })
      .map(function (r) {
        return {
          name:         r.name,
          label:        r.label   || r.name,
          state:      parseDefault(r.default, r.type),
          control_type: r.type    || 'boolean',
          zone:         r.zone    || 'main',
        }
      }),
  }
}

// ── Transform: snapshot → TrackControl config ─────────────────────────────────

/**
 * Convert a track-builder track snapshot into a ready-to-use TrackControl config.
 *
 * Expected snapshot shape (from createTrackBuilderTrack().getFullSnapshot()):
 * {
 *   identity:  { name, label, allow_jump },
 *   structure: { pages: [ <PageControl config>, … ] },
 *   preview:   { config_json }
 * }
 *
 * The pages array comes directly from PageListBuilderControl.getValue() — each
 * element is already a fully-formed PageControl config produced by the embedded
 * page-builder wizard.
 *
 * @param {Object} snap  getFullSnapshot() result from createTrackBuilderTrack()
 * @returns {Object}     TrackControl config
 */
export function buildTrackConfig (snap) {
  const id    = snap.identity  || {}
  const pages = Array.isArray((snap.structure || {}).pages)
    ? snap.structure.pages
    : []

  return {
    name:         id.name   || 'my_track',
    label:        id.label  || 'My Track',
    state:      0,
    control_type: 'track',
    allowJump:    id.allow_jump === true || id.allow_jump === 'true',
    pages,
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function _getPreviewCtrl (track, stepName, fieldName) {
  var step = track.getStep(stepName)
  if (!step) return null
  return step._controls.find(function (c) { return c.getName() === fieldName }) || null
}

function _updatePreview (track, stepName, fieldName, json) {
  var ctrl = _getPreviewCtrl(track, stepName, fieldName)
  if (!ctrl) return
  if (typeof ctrl.setCode === 'function') {
    ctrl.setCode(json)
  } else {
    ctrl.setValue(json)
  }
}

// ── Page Builder Track ────────────────────────────────────────────────────────

/**
 * Create a pre-wired TrackControl that walks the user through building a
 * PageControl config.
 *
 * Steps:
 *   1. identity  — name, label, description, layout (SelectionControl)
 *   2. children  — list_builder: one row per control, defines children[]
 *   3. preview   — collapsible JSON of the generated PageControl config
 *
 * @param {Object}   options
 * @param {string}  [options.rootID='page_builder']  ID prefix for the track
 * @param {function}[options.onComplete]  Called with the built PageControl config
 * @returns {TrackControl}
 */
export function createPageBuilderTrack ({ rootID, onComplete } = {}) {
  rootID = rootID || 'page_builder'

  const track = TrackControl.fromConfig({
    name:         'page_builder',
    label:        'Page Builder',
    state:      0,
    control_type: 'track',
    allowJump:    true,
    rootID:       rootID,
    pages: [
      {
        name:   'identity',
        label:  'Step 1 — Page Identity',
        layout: 'full-width',
        children: [
          {
            name:         'name',
            label:        'Page Name',
            state:      'my_page',
            control_type: 'text_input',
            placeholder:  'snake_case identifier',
          },
          {
            name:         'label',
            label:        'Display Title',
            state:      'My Page',
            control_type: 'text_input',
            placeholder:  'Human-readable title',
          },
          {
            name:         'description',
            label:        'Description',
            state:      'A page built with the page builder.',
            control_type: 'text_input',
            placeholder:  'Optional subtitle',
          },
          {
            name:         'layout',
            label:        'Page Layout',
            state:      'full-width',
            control_type: 'selection',
            values:       ['full-width', 'sidebar-left', 'sidebar-right', 'two-pane', 'dashboard-3'],
          },
        ],
      },
      {
        name:   'children',
        label:  'Step 2 — Control Definitions',
        layout: 'full-width',
        children: [
          {
            name:         'fields',
            label:        'Controls',
            state:      [],
            control_type: 'list_builder',
            maxRows:      30,
            emptyHint:    'No controls defined yet — click + Add to add one.',
            fields: [
              { name: 'name',    label: 'Name',    type: 'text',   placeholder: 'field_name'   },
              { name: 'label',   label: 'Label',   type: 'text',   placeholder: 'Display Label' },
              { name: 'type',    label: 'Type',    type: 'select',
                options: ['boolean', 'text_input', 'radio', 'selection', 'log_viewer', 'composite'] },
              { name: 'default', label: 'Default', type: 'text',   placeholder: 'e.g. false'   },
              { name: 'zone',    label: 'Zone',    type: 'text',   placeholder: 'main'          },
            ],
          },
        ],
      },
      {
        name:   'preview',
        label:  'Step 3 — Preview & Export',
        layout: 'full-width',
        children: [
          {
            name:         'config_json',
            label:        'Generated PageControl Config',
            state:      '// Navigate through steps 1 & 2, then return here.',
            control_type: 'collapsible_code',
          },
        ],
      },
    ],
  })

  track.onPageChange(function (from, to) {
    if (to !== 2) return
    var json = JSON.stringify(buildPageConfig(track.getFullSnapshot()), null, 2)
    _updatePreview(track, 'preview', 'config_json', json)
  })

  track.onComplete(function () {
    if (typeof onComplete === 'function') {
      onComplete(buildPageConfig(track.getFullSnapshot()))
    }
  })

  return track
}

// ── Track Builder Track ────────────────────────────────────────────────────────

/**
 * Show a timed validation-error banner inside a track's DOM element.
 * Finds or creates a .tk-build-error div, sets the message, and auto-hides
 * it after 4 s.
 */
function _showStepError (track, msg) {
  var el   = track.getElement()
  var err  = el.querySelector('.tk-build-error')
  if (!err) {
    err = document.createElement('div')
    err.className = 'tk-build-error'
    // Insert after the nav-top dots, before the steps content
    var navTop = el.querySelector('.tk-nav-top')
    if (navTop && navTop.parentNode === el) {
      el.insertBefore(err, navTop.nextSibling)
    } else {
      el.insertBefore(err, el.firstChild)
    }
  }
  err.textContent = msg
  err.hidden = false
  clearTimeout(err._t)
  err._t = setTimeout(function () { err.hidden = true }, 4000)
}

/**
 * Create a pre-wired TrackControl that walks the user through building a
 * TrackControl config (a series of pages, each built with the page builder).
 *
 * Steps:
 *   1. identity  — track name, label, allow_jump flag
 *   2. structure — PageListBuilderControl: one card per page, each built with
 *                  the inline page-builder wizard
 *   3. preview   — collapsible JSON of the generated TrackControl config
 *
 * Validation gates:
 *   Step 1 → name and label must be non-empty
 *   Step 2 → at least one page must be added
 *
 * @param {Object}   options
 * @param {string}  [options.rootID='track_builder']  ID prefix for the track
 * @param {function}[options.onComplete]  Called with the built TrackControl config
 * @returns {TrackControl}
 */
export function createTrackBuilderTrack ({ rootID, onComplete } = {}) {
  rootID = rootID || 'track_builder'

  const track = TrackControl.fromConfig({
    name:         'track_builder',
    label:        'Track Builder',
    state:      0,
    control_type: 'track',
    allowJump:    false,
    rootID:       rootID,
    pages: [
      {
        name:   'identity',
        label:  'Step 1 \u2014 Track Identity',
        layout: 'full-width',
        children: [
          {
            name:         'name',
            label:        'Track Name',
            state:      'my_track',
            control_type: 'text_input',
            placeholder:  'snake_case identifier',
          },
          {
            name:         'label',
            label:        'Track Title',
            state:      'My Track',
            control_type: 'text_input',
            placeholder:  'Human-readable title',
          },
          {
            name:         'allow_jump',
            label:        'Allow jumping between steps (dot nav)',
            state:      false,
            control_type: 'boolean',
          },
        ],
      },
      {
        name:   'structure',
        label:  'Step 2 \u2014 Pages',
        layout: 'full-width',
        children: [
          {
            name:         'pages',
            label:        'Pages',
            state:      [],
            control_type: 'page_list_builder',
          },
        ],
      },
      {
        name:   'preview',
        label:  'Step 3 \u2014 Preview & Export',
        layout: 'full-width',
        children: [
          {
            name:         'config_json',
            label:        'Generated TrackControl Config',
            state:      '// Navigate through steps 1 & 2, then return here.',
            control_type: 'collapsible_code',
          },
        ],
      },
    ],
  })

  // Inject the page builder wizard factory into the PageListBuilderControl.
  // Done post-construction to break the circular dep:
  //   controls/index.js → PageListBuilderControl → builders.js → TrackControl
  //                                                             → ControlFactory
  //                                                             → controls/index.js
  var pagesCtrl = track.getStep('structure')._controls
    .find(function (c) { return c.getName() === 'pages' })
  if (pagesCtrl) {
    pagesCtrl.config.wizardFactory = createPageBuilderTrack
  }

  // ── Step validators ────────────────────────────────────────────────────────

  // Step 0 — identity: name and label must both be non-empty
  track.setPageValidator(0, function (snap) {
    return Boolean(snap.name  && String(snap.name).trim())
        && Boolean(snap.label && String(snap.label).trim())
  })

  // Step 1 — structure: at least one page required
  track.setPageValidator(1, function (snap) {
    return Array.isArray(snap.pages) && snap.pages.length > 0
  })

  // ── Validation-fail error display ──────────────────────────────────────────

  track.onValidationFail(function (stepIndex, snap) {
    if (stepIndex === 0) {
      var msgs = []
      if (!snap.name  || !String(snap.name).trim())  msgs.push('Track name is required')
      if (!snap.label || !String(snap.label).trim()) msgs.push('Track label is required')
      _showStepError(track, msgs.join(' \u00b7 ') || 'Validation failed')
    } else if (stepIndex === 1) {
      _showStepError(track, 'At least one page is required \u2014 click \u201c+ Build Page\u201d to add one')
    }
  })

  // ── Preview refresh ────────────────────────────────────────────────────────

  track.onPageChange(function (from, to) {
    if (to !== 2) return
    var json = JSON.stringify(buildTrackConfig(track.getFullSnapshot()), null, 2)
    _updatePreview(track, 'preview', 'config_json', json)
  })

  // ── Completion ─────────────────────────────────────────────────────────────

  track.onComplete(function () {
    if (typeof onComplete === 'function') {
      onComplete(buildTrackConfig(track.getFullSnapshot()))
    }
  })

  return track
}
