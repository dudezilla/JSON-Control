import { Control }                   from '../ControlCollection.js'
import { PageControl }               from './PageControl.js'
import { createTrackBuilderTrack }   from '../builders.js'

/**
 * @classdesc WorkspaceControl — the landing-page composite control.
 *
 * Declares the entire workspace hub as a single registered control so the
 * landing page can be instantiated from a plain JSON config object:
 *
 *   ControlFactory.build({
 *     control_type: 'workspace',
 *     name:         'workspace',
 *     label:        'Workspace Hub',
 *   }).mount(root)
 *
 * Internally builds a PageControl from config.children (or the canonical
 * DEFAULT_CHILDREN when children is omitted), then wires up:
 *   • TrackViewControl  → ConfigDownloadControl (tracks → download value)
 *   • TrackViewControl  → PageViewControl       (tracks → all-pages display)
 *   • ConfigUploadControl → TrackViewControl    (file load → set tracks)
 *
 * Layout (sidebar-left by default):
 *   ┌──────────────┬────────────────────────────────┐
 *   │ Save         │ Tracks                          │
 *   │ [↓ Download] │  card · card · [+ New Track]   │
 *   │              │                                 │
 *   │ Load         │ Pages                           │
 *   │ [↑ Upload]   │  all pages across all tracks    │
 *   └──────────────┴────────────────────────────────┘
 *
 * Config:
 *   {
 *     name:         'workspace',
 *     label:        'Workspace Hub',
 *     control_type: 'workspace',
 *     state:      {},
 *     layout:       'sidebar-left',   // optional; overrides default layout
 *     storageKey:   'lz_workspace',   // optional; passed to TrackViewControl
 *     children:     [ … ],            // optional; overrides DEFAULT_CHILDREN
 *   }
 *
 * API:
 *   getValue()         → { tracks: [...TrackControl configs...] }
 *   setValue({ tracks }) → replace the workspace track list
 *   mount(el)          → mount the page into el, return this
 */

// ── Default child-control configuration ───────────────────────────────────────

const DEFAULT_CHILDREN = [
  {
    zone:         'sidebar',
    name:         'workspace_download',
    label:        'Save Workspace',
    control_type: 'config_download',
    state:      { tracks: [] },
    fileName:     'workspace.json',
  },
  {
    zone:         'sidebar',
    name:         'workspace_upload',
    label:        'Load Workspace',
    control_type: 'config_upload',
    state:      {},
    accept:       '.json',
  },
  {
    zone:         'main',
    name:         'tracks',
    label:        'Tracks',
    control_type: 'track_view',
    state:      [],
  },
  {
    zone:         'main',
    name:         'pages',
    label:        'Pages',
    control_type: 'page_view',
    state:      [],
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function _findCtrl (page, name) {
  for (const ctrl of page.subControls) {
    if (ctrl.getName() === name) return ctrl
  }
  return null
}

function _allPages (tracks) {
  const out = []
  for (const track of tracks) {
    if (!Array.isArray(track.pages)) continue
    for (const page of track.pages) {
      out.push(Object.assign({}, page, { _trackLabel: track.label || track.name }))
    }
  }
  return out
}

// ── WorkspaceControl ──────────────────────────────────────────────────────────

class WorkspaceControl extends Control {
  /**
   * @param {Object} controlConfig  Plain config object.
   *   Any omitted child field falls back to DEFAULT_CHILDREN.
   */
  constructor (controlConfig) {
    super(controlConfig)

    // Build the inner PageControl from the declared children config
    this._page = PageControl.fromConfig({
      name:         controlConfig.name  || 'workspace',
      label:        controlConfig.label || 'Workspace Hub',
      control_type: 'page',
      state:      {},
      layout:       controlConfig.layout || 'sidebar-left',
      children:     Array.isArray(controlConfig.children)
                      ? controlConfig.children
                      : DEFAULT_CHILDREN.map(function (c) {
                          // Allow storageKey to propagate to track_view
                          if (c.control_type === 'track_view' && controlConfig.storageKey) {
                            return Object.assign({}, c, { storageKey: controlConfig.storageKey })
                          }
                          return c
                        }),
    })

    // Named sub-control references
    this._tracksCtrl   = _findCtrl(this._page, 'tracks')
    this._pagesCtrl    = _findCtrl(this._page, 'pages')
    this._downloadCtrl = _findCtrl(this._page, 'workspace_download')

    // Wire up cross-control events and initial state
    this._wire()

    // Expose the inner page element as this control's element
    this.element = this._page.getElement()
  }

  // ── Event wiring ────────────────────────────────────────────────────────────

  _wire () {
    const tracksCtrl   = this._tracksCtrl
    const pagesCtrl    = this._pagesCtrl
    const downloadCtrl = this._downloadCtrl

    // Inject the track-builder wizard factory into TrackViewControl.
    // Injected here (not inside TrackViewControl.js) to break the circular dep:
    //   controls/index.js → WorkspaceControl.js → builders.js → TrackControl.js
    //                     → ControlFactory.js → controls/index.js
    // Live bindings ensure createTrackBuilderTrack is populated before any
    // constructor call reaches _wire(), so the cycle is benign.
    if (tracksCtrl) {
      tracksCtrl.config.wizardFactory = createTrackBuilderTrack
    }

    // onAnyChange fires whenever any child fires eventLinkage.
    // Distinguish change sources by shape:
    //   Array          → TrackViewControl fired with its tracks list
    //   { tracks: [] } → ConfigUploadControl fired with a loaded workspace file
    var _handlingUpload = false
    this._page.onAnyChange(function (change) {
      if (Array.isArray(change)) {
        // ── Tracks changed: keep download + pages in sync ───────────────────
        if (downloadCtrl) downloadCtrl.setValue({ tracks: change })
        if (pagesCtrl)    pagesCtrl.setValue(_allPages(change))
      } else if (
        !_handlingUpload &&
        change && typeof change === 'object' &&
        Array.isArray(change.tracks)
      ) {
        // ── File uploaded: push tracks into the track view ──────────────────
        // Guard flag prevents the subsequent eventLinkage from re-entering.
        _handlingUpload = true
        if (tracksCtrl) tracksCtrl.setValue(change.tracks)
        _handlingUpload = false
      }
    })

    // ── Initial sync ─────────────────────────────────────────────────────────
    // TrackViewControl reads localStorage in its constructor and fires
    // eventLinkage, but onAnyChange is not registered yet at that point.
    // Push the loaded state to download + pages now.
    if (tracksCtrl && downloadCtrl) {
      const initial = tracksCtrl.getValue()
      downloadCtrl.setValue({ tracks: initial })
      if (pagesCtrl) pagesCtrl.setValue(_allPages(initial))
    }
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  /**
   * Returns the current workspace state.
   * @returns {{ tracks: Array }}
   */
  getValue () {
    return { tracks: this._tracksCtrl ? this._tracksCtrl.getValue() : [] }
  }

  /**
   * Load a workspace state.
   * @param {{ tracks: Array }} v
   */
  setValue (v) {
    if (v && Array.isArray(v.tracks) && this._tracksCtrl) {
      this._tracksCtrl.setValue(v.tracks)
    }
  }

  /**
   * Delegate to the inner PageControl so ControlFactory.mount() works correctly.
   * Without this, the base-class buildSubControls() would iterate the empty
   * WorkspaceControl.subControls list and return an unpopulated container.
   * @returns {HTMLElement}
   */
  buildSubControls () {
    return this._page.buildSubControls()
  }

  /**
   * Mount the workspace into a DOM element.
   * @param {Element} el
   * @returns {WorkspaceControl} this — chainable
   */
  mount (el) {
    this._page.mount(el)
    return this
  }

  getElement () {
    return this._page.getElement()
  }
}

// ── Registration ──────────────────────────────────────────────────────────────

WorkspaceControl.controlType = 'workspace'

WorkspaceControl.meta = {
  controlType:   'workspace',
  category:      'composite',
  description:   [
    'Workspace landing-page composite. Sidebar: ConfigDownloadControl + ConfigUploadControl.',
    'Main: TrackViewControl (with inline track-builder wizard) + PageViewControl.',
    'Wires upload→tracks, tracks→download+pages. Persists to localStorage.',
    'Instantiate with just { control_type: "workspace" } — children default to the canonical workspace layout.',
  ].join(' '),
  defaultConfig: {
    name:         'workspace',
    label:        'Workspace Hub',
    control_type: 'workspace',
    state:      {},
    layout:       'sidebar-left',
    children:     DEFAULT_CHILDREN,
  },
  tests: [
    {
      name: 'getValue returns { tracks: [] } initially',
      fn: (ctrl) => {
        const v = ctrl.getValue()
        return v && Array.isArray(v.tracks) && v.tracks.length === 0
      },
    },
    {
      name: 'setValue({ tracks }) updates the track view',
      fn: (ctrl) => {
        const page = { control_type: 'page', name: 'p', label: 'P', children: [] }
        ctrl.setValue({ tracks: [
          { control_type: 'track', name: 't1', label: 'T1', pages: [page] },
        ] })
        return ctrl.getValue().tracks.length === 1
      },
    },
    {
      name: 'setValue(null) is a no-op',
      fn: (ctrl) => {
        ctrl.setValue(null)
        return Array.isArray(ctrl.getValue().tracks)
      },
    },
    {
      name: 'getElement returns an HTMLElement',
      fn: (ctrl) => ctrl.getElement() instanceof HTMLElement,
    },
    {
      name: 'DOM contains pc-layout-sidebar-left class',
      fn: (ctrl) => ctrl.getElement().querySelector('.pc-layout-sidebar-left') !== null,
    },
    {
      name: 'DOM contains sidebar zone',
      fn: (ctrl) => ctrl.getElement().querySelector('.pc-zone-sidebar') !== null,
    },
    {
      name: 'DOM contains main zone',
      fn: (ctrl) => ctrl.getElement().querySelector('.pc-zone-main') !== null,
    },
    {
      name: 'tracks sub-control is a TrackViewControl',
      fn: (ctrl) => {
        const tc = ctrl._tracksCtrl
        return tc !== null && typeof tc.getValue === 'function' && Array.isArray(tc.getValue())
      },
    },
    {
      name: 'download sub-control is present',
      fn: (ctrl) => ctrl._downloadCtrl !== null,
    },
    {
      name: 'wizardFactory is injected into track sub-control',
      fn: (ctrl) => typeof ctrl._tracksCtrl.config.wizardFactory === 'function',
    },
    {
      name: 'adding a track syncs to download control value',
      fn: (ctrl) => {
        const page = { control_type: 'page', name: 'p', label: 'P', children: [] }
        ctrl._tracksCtrl._addTrack({
          control_type: 'track', name: 'my_t', label: 'My T', pages: [page],
        })
        const dl = ctrl._downloadCtrl.getValue()
        return Array.isArray(dl.tracks) && dl.tracks.length === 1
      },
    },
    {
      name: 'adding a track syncs to page view',
      fn: (ctrl) => {
        ctrl.setValue({ tracks: [] })
        const page = {
          control_type: 'page', name: 'p', label: 'My Page',
          layout: 'full-width', children: [],
        }
        ctrl._tracksCtrl._addTrack({
          control_type: 'track', name: 'my_t', label: 'My T', pages: [page],
        })
        return ctrl._pagesCtrl.getValue().length === 1
      },
    },
  ],
}

export { WorkspaceControl }
