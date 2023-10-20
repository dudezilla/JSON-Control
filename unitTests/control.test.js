const ControlCollectionModule = require('../src/ControlCollection.js')
const ControlBindings = ControlCollectionModule.ControlBindings
const Control = ControlCollectionModule.Control
const ControlConfiguration = ControlCollectionModule.ControlConfiguration

beforeEach(() => {
  global.dudezilla = { bindings: new ControlBindings() }
})

/***
 * @param {String} - letter - a letter of the alphabet
 * @param {number} - number - a number
 */

function getControlConfig (letter, number, div, parent) {
  const config = {
    name: `${letter}${number}`,
    label: 'test control',
    current: '0',
    control_type: 'test_control'
  }
  const concon = new ControlConfiguration(config)
  concon.setRootID(div)
  concon.setParent(parent)
  return concon
}

test('Make a control, then fetch it.', () => {
  const bindings = global.dudezilla.bindings

  let control
  try {
    control = new Control(getControlConfig('a', '0', 'root', undefined))
    bindings.append(control)
  } catch (e) { throw new Error('Failed to make control.') }

  let rootNode
  try {
    rootNode = bindings.fetch('root__a0')
    expect(rootNode).toBeDefined()
  } catch (e) { throw new Error('fetch for root__a0 failed.') }

  let fetched
  let a0B0

  try {
    fetched = rootNode
    a0B0 = new Control(getControlConfig('b', '0', fetched.getID(), fetched))
  } catch (e) {
    console.log('error', e)
    throw new Error('Failed to make a0_b0.')
  }

  try {
    fetched.appendChild(a0B0)
  } catch (e) { throw new Error('Failed to append a0_b0 to root.') }

  try {
    fetched.appendChild(new Control(getControlConfig('b', 1, fetched.getID(), fetched)))
  } catch (e) { throw new Error('Failed to append a0_b1 to root.') }

  // out of scope.
  expect(() => { bindings.fetch('root__a0__b0') }).toThrow()

  fetched = bindings.fetchGlobal('root__a0__b0')
  expect(fetched).toBe(a0B0)
  expect((fetched === a0B0)).toBe(true)
  let a0B0C0
  try { a0B0C0 = new Control(getControlConfig('c', 0, fetched.getID(), fetched)) } catch (e) { throw new Error('Failed to make a0_b0_c0.') }
  try { fetched.appendChild(a0B0C0) } catch (e) { throw new Error('Failed to append a0_b0_c0 to a0_b0.') }

  // out of scope.
  expect(() => { bindings.fetch('root__a0__b0__c0') }).toThrow()
  // you remember what fetched is, right? - It's linear! just scroll up!
  const fetchedLocal = fetched.subControls.fetch('root__a0__b0__c0')

  const fetchedGlobal = bindings.fetchGlobal('root__a0__b0__c0')
  expect(fetchedGlobal).toBe(a0B0C0)
  expect(fetchedLocal).toBe(a0B0C0)
  expect(a0B0.subControls.fetch('root__a0__b0__c0')).toBe(a0B0C0)

  const duplicateConf = getControlConfig('b', 1, rootNode.getID(), rootNode)
  expect(duplicateConf.isValid()).toBe(true)
  duplicateControl = new Control(duplicateConf)
  expect(() => { rootNode.appendChild(duplicateControl) }).toThrow()
  fetched = rootNode.subControls.fetch('root__a0__b1')
  expect(() => { fetched.subControls.fetch('root__a0__b0__c0') }).toThrow()

  fetched.appendChild(new Control(getControlConfig('c', 1, fetched.getID(), fetched)))
  fetched.appendChild(new Control(getControlConfig('c', 2, fetched.getID(), fetched)))
  fetched.appendChild(new Control(getControlConfig('c', 3, fetched.getID(), fetched)))
  fetched.appendChild(new Control(getControlConfig('c', 4, fetched.getID(), fetched)))
  fetched = fetched.subControls.fetch('root__a0__b1__c2')
  const a0B0C2 = rootNode.subControls.fetchGlobal('root__a0__b1__c2')
  expect(a0B0C2).toBe(fetched)
})

afterEach(() => {
  delete global.dudezilla
})
