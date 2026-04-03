/**
 * shell.js — browser entry point for the demo site.
 *
 * Routing (via ?view= query param):
 *
 *   (none) | view=landing   → Workspace landing zone (no registry needed)
 *   view=controls           → Control library directory
 *   view=control&type=X     → Individual control demo page
 *
 * The control registry is built client-side only when needed: fetches the
 * control file list from /api/source/controls/, dynamically imports each
 * module, and reads each class's static .meta property — no bundler.
 */
import { renderControl, renderDirectory } from './page.js'
import { buildRegistry }                  from './build_registry.js'
import { renderLanding }                  from './landing.js'

function showError (msg) {
  var root = document.getElementById('root')
  var p = document.createElement('p')
  p.className = 'error'
  p.textContent = msg
  root.innerHTML = ''
  root.appendChild(p)
}

window.addEventListener('load', function () {
  var params      = new URLSearchParams(location.search)
  var view        = params.get('view') || 'landing'
  var controlType = params.get('type') || ''

  // Landing zone — no registry needed, renders immediately
  if (view === 'landing' || view === '') {
    renderLanding()
    return
  }

  // Control library views — need the registry
  buildRegistry()
    .then(function (control_registry) {
      if (view === 'control' && controlType) {
        renderControl(control_registry, controlType)
      } else {
        // view=controls or any unrecognised view → directory
        renderDirectory(control_registry)
      }
    })
    .catch(function (err) {
      showError('Failed to build control registry: ' + err.message)
    })
})
