/**
 * landing.js — Workspace landing zone.
 *
 * The landing page is a single WorkspaceControl instance built from its
 * canonical defaultConfig.  WorkspaceControl (control_type: 'workspace')
 * is a self-contained composite that owns its layout, children, event wiring,
 * and localStorage persistence — the config is the complete specification.
 *
 * This file contains no layout or wiring logic.  It bridges the shell.js
 * routing API (renderLanding / mountLanding) to WorkspaceControl.
 *
 * Public exports:
 *   renderLanding()      — used by shell.js (mounts to #root)
 *   mountLanding(root)   — mounts into an arbitrary element
 */

import { WorkspaceControl } from './controls/WorkspaceControl.js'

/**
 * Build and mount the workspace landing page into `root`.
 * @param {Element} root
 * @returns {WorkspaceControl}
 */
export function mountLanding (root) {
  root.innerHTML = ''
  return new WorkspaceControl(WorkspaceControl.meta.defaultConfig).mount(root)
}

/**
 * Shell.js entry point — finds #root and mounts into it.
 */
export function renderLanding () {
  var root = document.getElementById('root')
  if (!root) {
    root = document.createElement('div')
    root.id = 'root'
    document.body.appendChild(root)
  }
  mountLanding(root)
}
