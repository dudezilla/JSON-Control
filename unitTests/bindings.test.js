const fixtureBindings = require('./bindingsFixture.js')
const BF = new fixtureBindings.BindingsFixture()
const ControlCollectionModule = require('../src/ControlCollection.js')
const ControlBindings = ControlCollectionModule.ControlBindings
const Control = ControlCollectionModule.Control
const ControlConfiguration = ControlCollectionModule.ControlConfiguration

beforeEach(() => {
  global.dudezilla = { bindings: new ControlBindings() }
})

/**
 * "Are bindings under global.dudezilla.bindings?"
 *
 */
test('Test 1', () => {
  // BF.makeTopLevel();
  expect(global.dudezilla).toBeDefined()
  expect(global.dudezilla.bindings).toBeDefined()
})

/**
 *  Fetch the global Control_Binding using bad keys.
 *
 *   `Fetch the global Control_Binding then
 *    attempt to fetch a key that is not used in the global control.
 *    This is not a recursive search.`
 */
test('Test 2', () => {
  BF.makeTopLevel()
  const bindings = global.dudezilla.bindings
  expect(bindings.isGlobal()).toBe(true)
  checkBadKeys(bindings)
})

/**
 *   Fetch the global Control_Binding then
 *    fetch a Control that has a child then
 *    test that control against bad keys.`
 */
test('Test 3', () => {
  let control
  try { BF.makeTopLevel() } catch (e) { throw new Error('Failed to make top-level node!') }
  try { control = global.dudezilla.bindings.fetch('root__a0') } catch (e) { throw new Error('Failed to fetch root__a0') }
  try { BF.makeChild() } catch (e) { throw new Error('Failed to make child.') }
  const bindings = control.subControls
  expect(bindings.isGlobal()).toBe(false)
  try { checkBadKeys(bindings) } catch (e) { throw new Error('Failed at check bad keys.') }
})

/**
 *  Fetch a subcontrol against bad keys.
 *  `Fetch the global Control_Binding then
     fetch a Control that has NO child then
     test that control against bad keys.`
 *
 *
 */
test('Test 4', () => {
  BF.makeTopLevel()
  BF.makeChild()
  const bindings = global.dudezilla.bindings.fetch('root__a0').subControls
  expect(bindings.isGlobal()).toBe(false)
  checkBadKeys(bindings)
})

/**
 *  @param {ControlBindings} - bindings - The bindings to test.
 *
 */
function checkBadKeys (bindings) {
  const keyErrors = ['root_badkey', '', 'root__root', 'a0__root']
  for (let i = 0; i < keyErrors.length; i++) {
    try {
      bindings.fetch(keyErrors[i])
      fail('Expected an exception to be thrown.')
    } catch (e) {

    }
  }
}

/**
 * Test the following specific behavior of the fetch method.
 * - Fetch using a valid key.
 * - The key is a root-level key.
 * - The Control exists in the mapping table under "key".
* "With global.dudezilla.bindings test the fetch method at this depth."
*/
test('Test 5', () => {
  BF.makeTopLevel()
  const bindings = global.dudezilla.bindings
  const nodeA0 = bindings.fetch('root__a0')
  expect(nodeA0).toBeDefined()
  expect(nodeA0.getID()).toBe('root__a0')
})

/**
 * Obtain a child element using the fetch and fetchGlobal methods.
 * "Check that child elements can be inserted and fetched"
 */
test('Test 6', () => {
  BF.makeTopLevel()
  BF.makeChild()
  const bindings = global.dudezilla.bindings
  const nodeA0 = bindings.fetch('root__a0')
  expect(nodeA0).toBeDefined()
  const bindingsA0 = nodeA0.subControls
  expect(bindingsA0).toBeDefined()
  expect(bindingsA0).not.toBeNull()
  expect(bindingsA0 === bindings).toBe(false)
  const fetchLocalLocal = bindingsA0.fetch('root__a0__b0')
  const fetchLocalGlobal = bindingsA0.fetchGlobal('root__a0__b0')
  const fetchGlobal = bindings.fetchGlobal('root__a0__b0')
})

/**
 * Attempt to fetch for empty string and null.
 */
test('Test fetch against empty string and null', () => {
  global.dudezilla = {
    bindings: undefined
  }
  const bindings = new ControlBindings()
  try { bindings.fetch(''); fail('bindings needs to throw an Error') } catch (e) { };
  try { bindings.fetch(); fail('bindings needs to throw an Error') } catch (e) { };
  try { bindings.fetchGlobal(''); fail('bindings needs to throw an Error') } catch (e) { };
  try { bindings.fetchGlobal(); fail('bindings needs to throw an Error') } catch (e) { };

  global.dudezilla.bindings = bindings
  try { bindings.fetch(''); fail('bindings needs to throw an Error') } catch (e) { };
  try { bindings.fetch(); fail('bindings needs to throw an Error') } catch (e) { };
  try { bindings.fetchGlobal(''); fail('bindings needs to throw an Error') } catch (e) { };
  try { bindings.fetchGlobal(); fail('bindings needs to throw an Error') } catch (e) { };
})

afterEach(() => {
  delete global.dudezilla
})
