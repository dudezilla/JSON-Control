// @ts-check
const ControlCollection = require('../src/ControlCollection.js')
const ControlConfiguration = ControlCollection.ControlConfiguration
const Control = ControlCollection.Control

function makeConfig (name, label, current, controlType) {
  return { name, label, current, control_type: controlType }
}

test('Instantiate a control configuration object.', () => {
  const cc = new ControlConfiguration(makeConfig('test', 'Test', 'somevalue', 'Test_Control'))
  expect(cc).toBeDefined()
  expect(cc.isValid()).toBe(false)
  cc.setRootID('root')
  expect(cc.isValid()).toBe(true)
  expect(cc.getRootID()).toBe('root')
})

test('Instantiate a control configuration objects that fail for various reasons.', () => {
  // blank name
  let con = makeConfig('', 'Test', 'somevalue', 'Test_Control')
  let conConf = new ControlConfiguration(con)
  conConf.setRootID('root')
  expect(conConf.isValid()).toBe(false)
  // blank label
  con = makeConfig('test', '', 'somevalue', 'Test_Control')
  conConf = new ControlConfiguration(con)
  conConf.setRootID('root')
  expect(conConf.isValid()).toBe(false)
  // blank current
  con = makeConfig('test', 'Test', '', 'Test_Control')
  conConf = new ControlConfiguration(con)
  conConf.setRootID('root')
  expect(conConf.isValid()).toBe(false)
  // blank control_type
  con = makeConfig('test', 'Test', 'somevalue', '')
  conConf = new ControlConfiguration(con)
  conConf.setRootID('root')
  expect(conConf.isValid()).toBe(false)
  // blank control_type
  con = makeConfig('test', 'Test', 'somevalue', 'Test_Control')
  con.name = null
  conConf = new ControlConfiguration(con)
  conConf.setRootID('root')
  expect(conConf.isValid()).toBe(false)
  con = makeConfig('test', 'Test', 'somevalue', 'Test_Control')
  delete con.name
  conConf = new ControlConfiguration(con)
  conConf.setRootID('root')
  expect(conConf.isValid()).toBe(false)
})

test('Validate - with parrent and root combinations', () => {
  // expect(false).toBe(true);

  let con

  con = makeConfig('test', 'Test', 'somevalue', 'Test_Control')

  // Should fail validation - no root_id is set.
  let conConf = new ControlConfiguration(con)
  expect(conConf.isValid()).toBe(false)

  // set root and rerun validation.
  conConf.setRootID('root')

  // Should pass validation - root_id is set.
  expect(conConf.isValid()).toBe(true)
  const control = new Control(conConf)

  // Should pass validation - a parent is set.
  conConf = new ControlConfiguration(con)
  conConf.setParent(control)

  // Was the parent set?
  expect(conConf.getParent()).toBe(control)
  expect(conConf.isValid()).toBe(true)

  // Should pass validation - a parent is set and a root_id is set.
  conConf = new ControlConfiguration(con)
  conConf.setParent(control)
  conConf.setRootID(control.getID())
  expect(conConf.isValid()).toBe(true)

  // Should pass validation - a parent is set and a root_id is set.
  conConf = new ControlConfiguration(con)
  conConf.setParent(control)
  conConf.setRootID(control.getID() + 'this string will make the test fail.')
  expect(conConf.isValid()).toBe(false)
})
