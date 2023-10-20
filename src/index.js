const jsdom = require('jsdom')
const dom = new jsdom.JSDOM('<!DOCTYPE html><p>Hello world</p><div id=\'root\'></div>')
const fs = require('fs')

// /**
//  * @property {function} writeFile - Write a file to the filesystem.
//  * @param {string} fileName - The name of the file to write.
//  * @param {string} fileContent - The content of the file to write.
//  */

async function writeFile (fileName, fileContent) {
  try {
    await fs.writeFile(fileName, fileContent, (err) => {
      if (err) {
        console.log('ERROR WRITING FILE!', err)
        throw err
      }
    })
  } catch (err) {
    console.log('ERROR WRITING FILE!', err)
  }
}


global.document = dom.window.document
global.window = dom.window

const ControlCollection = require('./ControlCollection.js')
const ControlBindings = ControlCollection.ControlBindings
const ControlConfiguration = ControlCollection.ControlConfiguration

const TestControlClass = require('./TestControl.js')
const TestControl = TestControlClass.TestControl

const ValueDisplayControlClass = require('./ValueDisplayControl.js')
const ValueDisplayControl = ValueDisplayControlClass.ValueDisplayControl

global.dudezilla = { bindings: new ControlBindings() }

function makeConfig (letter, number) {
  return {
    name: `${letter}${number}`,
    label: 'test control',
    current: '0',
    control_type: 'test_control'
  }
}


const cc = new ControlConfiguration(makeConfig('a', 0))
cc.setRootID('root')
const lblValueDisplay = new ValueDisplayControl(cc)
console.log('test_control id:\n', lblValueDisplay.getID())
global.dudezilla.bindings.append(lblValueDisplay)
const fetched = global.dudezilla.bindings.fetch('root__a0')
if (fetched === lblValueDisplay) {
  console.log('PASS fetched === test_control')
} else {
  console.log('FAIL fetched !== test_control')
}
// console.log("test_control id:\n", test_control.get_id());
const text = lblValueDisplay.getElement()
// dom.window.document.getElementById("root").appendChild(text);
console.log('\t\tValue Display:\n', text.innerHTML)

// /** Insert a TestControl into the DOM.
//  */
const ccTwo = new ControlConfiguration(makeConfig('a', 1))
ccTwo.setRootID('root')
const tstControl = new TestControl(ccTwo)
console.log('test_control id:\n', tstControl.getID())
global.dudezilla.bindings.append(tstControl)
const fetchedTwo = global.dudezilla.bindings.fetch('root__a1')
if (fetchedTwo === tstControl) {
  console.log('PASS fetched === test_control')
} else {
  console.log('FAIL fetched !== test_control')
}
// console.log("test_control id:\n", test_control.get_id());
const textTwo = tstControl.getElement()
// dom.window.document.getElementById("root").appendChild(text);
// console.log('\t\tValue Display:\n', textTwo.innerHTML)
dom.window.document.getElementById('root').appendChild(textTwo)
console.log('dom.window.document:\n', dom.serialize())
console.log('TestControl:\n', TestControl)

writeFile('./index.html', dom.serialize())
