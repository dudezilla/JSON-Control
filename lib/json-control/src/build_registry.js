/**
 * build_registry.js — client-side control registry builder.
 *
 * Pure browser ES module — no Node.js, no bundler.
 *
 * Fetches the list of control files from /api/source/controls/, dynamically
 * imports each one as a native ES module, reads the static .meta property
 * from the exported class, and fetches the raw source text.
 *
 * Returns a control_registry object keyed by controlType — the same shape
 * that page.js and renderControl / renderDirectory expect:
 *
 *   control_registry[controlType] = {
 *     controlType, category, description, defaultConfig, tests, srcCode
 *   }
 */

/**
 * Build and return the full control registry from the live /src/controls/ files.
 * @returns {Promise<Object>} Resolves with a control_registry keyed by controlType.
 */
export async function buildRegistry () {
  var res
  try {
    res = await fetch('/api/source/controls/')
    if (!res.ok) throw new Error('HTTP ' + res.status)
  } catch (e) {
    throw new Error('build_registry: could not fetch control file list: ' + e.message)
  }

  var files = await res.json()
  var control_registry = {}

  for (var i = 0; i < files.length; i++) {
    var file = files[i]
    if (!file.endsWith('.js') || file === 'index.js') continue

    try {
      var mod  = await import('/src/controls/' + file)
      var Ctrl = Object.values(mod).find(function (v) {
        return typeof v === 'function' && v.meta && v.meta.controlType
      })
      if (!Ctrl) {
        console.warn('build_registry: no .meta found in', file)
        continue
      }

      var meta   = Ctrl.meta
      var srcRes = await fetch('/src/controls/' + file)
      var srcCode = srcRes.ok ? await srcRes.text() : '/* source unavailable */'

      control_registry[meta.controlType] = {
        controlType:   meta.controlType,
        category:      meta.category      || 'other',
        description:   meta.description   || '',
        defaultConfig: meta.defaultConfig || null,
        tests:         meta.tests         || [],
        srcCode:       srcCode,
      }
    } catch (e) {
      console.warn('build_registry: failed to load', file, '—', e.message)
    }
  }

  return control_registry
}
