import { Control } from '../ControlCollection.js'

/**
 * @classdesc ViewportControl — a single-slot swap area.
 *
 * Holds exactly one control's DOM subtree at a time.  Calling show(ctrl)
 * detaches whatever is currently in the slot and moves ctrl's element in.
 * The outgoing control's element is not destroyed — it stays referenced by
 * its own Control instance, so field values and event listeners are preserved.
 *
 * Designed for use anywhere a "one-thing-at-a-time" window is needed:
 *   - Inside TrackControl to swap between pages on navigation
 *   - Standalone in config when a dynamic content area is required
 *
 * Usage (standalone config):
 * {
 *   name:         'content_area',
 *   label:        '',
 *   state:        null,
 *   control_type: 'viewport',
 * }
 *
 * Usage (programmatic):
 *   viewport.show(somePageControl)   // swap in
 *   viewport.clear()                 // empty the slot
 */
class ViewportControl extends Control {
  constructor (controlConfig) {
    super(controlConfig)

    this._slot = document.createElement('div')
    this._slot.className = 'vp-slot'

    const wrapper = document.createElement('div')
    wrapper.id        = this.getID()
    wrapper.className = 'ctrl ctrl-viewport'
    wrapper.appendChild(this._slot)

    this.element = wrapper
  }

  /**
   * Clear the slot and move ctrl's already-built element into it.
   * Moving a DOM element (via appendChild) detaches it from its previous
   * parent — the outgoing element is not destroyed, just de-parented.
   * @param {Control} ctrl — must have getElement() returning an HTMLElement.
   * @returns {ViewportControl} this — chainable
   */
  show (ctrl) {
    this.clear()
    if (ctrl) this._slot.appendChild(ctrl.getElement())
    return this
  }

  /**
   * Remove all children from the slot without destroying them.
   * @returns {ViewportControl} this — chainable
   */
  clear () {
    while (this._slot.firstChild) {
      this._slot.removeChild(this._slot.firstChild)
    }
    return this
  }

  /** @override — element is fully built in the constructor. */
  buildSubControls () { return this.getElement() }

  getValue () { return null }
  setValue () {}
}

ViewportControl.controlType = 'viewport'

ViewportControl.meta = {
  controlType:   'viewport',
  category:      'composite',
  description:   'Single-slot swap area. show(ctrl) clears the slot and moves the control\'s pre-built element into it without destroying the outgoing element.',
  defaultConfig: {
    name:         'content_area',
    label:        '',
    state:        null,
    control_type: 'viewport',
  },
  tests: [
    {
      name: 'DOM has vp-slot element',
      fn: function (ctrl) { return ctrl.getElement().querySelector('.vp-slot') !== null },
    },
    {
      name: 'show() inserts element into slot',
      fn: function (ctrl) {
        var div = document.createElement('div')
        div.id = 'test-child'
        ctrl.show({ getElement: function () { return div } })
        return ctrl.getElement().querySelector('#test-child') !== null
      },
    },
    {
      name: 'clear() empties the slot',
      fn: function (ctrl) {
        var div = document.createElement('div')
        ctrl.show({ getElement: function () { return div } })
        ctrl.clear()
        return ctrl.getElement().querySelector('.vp-slot').childNodes.length === 0
      },
    },
    {
      name: 'show() replaces previous content',
      fn: function (ctrl) {
        var a = document.createElement('div'); a.id = 'a'
        var b = document.createElement('div'); b.id = 'b'
        ctrl.show({ getElement: function () { return a } })
        ctrl.show({ getElement: function () { return b } })
        var slot = ctrl.getElement().querySelector('.vp-slot')
        return slot.querySelector('#b') !== null && slot.querySelector('#a') === null
      },
    },
    {
      name: 'show() with null does not throw',
      fn: function (ctrl) {
        try { ctrl.show(null); return true } catch (_) { return false }
      },
    },
  ],
}

export { ViewportControl }
