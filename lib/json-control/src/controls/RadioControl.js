import { Control, ControlRegistry, ControlConfiguration } from '../ControlCollection.js'
class RadioControl extends Control{

/* No it's not as cool as it sounds.

    use Radio style selection controls.

    radio schema:

    let config = {
        name: "name_of_el",
        state:caller.get_value() === caller.select_value(i),
        control_type:"radio"
    }

    //First composite element.
    //Why not start passing the relevent control bindings through the config
    //object.... You don't need to worry about that.
    //The anchor already contains that data!
    //and installers work outside of the object.

*/

    constructor(controlConfig){
        super(controlConfig);
        this.element = this.makeElement();
        this.appendHandler({
            'id':this.getID(),
            'type': 'click',
            'func': radioHandler
        });
    }

    /*
        Get the set name:
        THIS MUST BE RENAMED!~!!!!!!!!!!!!!!!
    */
    getSetName(){
        return this.getConfig().set_name;
    }

    makeElement(){
        let el = document.createElement("label");
        el.innerHTML = this.buildString();
        return el;
    }

    checkedString(){
        let checked = "";
        if(this.getValue()){
            checked = "checked";
        }
        return checked;
    }

    /*Nested in a label.
    */
    buildString(){
        //let anchor = this.get_anchor();
        this.appendHTML(`<input id="${this.getID()}" type="radio" name="${this.getSetName()}" ${this.checkedString()}>`);
        this.appendHTML(`${this.getLabel()}`);
        return this.getHTML();
    }
}

/*
    HACK! lets fix that in the scheema next!

    A label value has been added to the schema. - so
    TODO: 

    Should you be passing the value of the label to the composite?
*/
function radioHandler(){
    let control = globalThis.dudezilla.bindings.fetchGlobal(this.id);
    control.setValue(this.checked);
    control.eventLinkage(control.getLabel());
}
//export{Radio_Control};

RadioControl.controlType = 'radio'

RadioControl.meta = {
  controlType:   'radio',
  category:      'input',
  description:   'A single radio button. Typically used as a child of SelectionControl. Fires eventLinkage with its label value on click.',
  defaultConfig: { name: 'test_radio', label: 'Option A', state: false, control_type: 'radio', set_name: 'test_group' },
  tests: [
    {
      name: 'getValue returns initial false',
      fn: function (ctrl) { return ctrl.getValue() === false }
    },
    {
      name: 'setValue / getValue roundtrip',
      fn: function (ctrl) { ctrl.setValue(true); return ctrl.getValue() === true }
    },
    {
      name: 'getSetName returns set_name from config',
      fn: function (ctrl) { return ctrl.getSetName() === 'test_group' }
    },
    {
      name: 'getLabel returns configured label',
      fn: function (ctrl) { return ctrl.getLabel() === 'Option A' }
    },
    {
      name: 'buildSubControls returns a DOM element',
      fn: function (ctrl) { var el = ctrl.getElement(); return !!el && el.nodeType === 1 }
    },
    {
      name: 'DOM contains an input[type=radio]',
      fn: function (ctrl) { return ctrl.getElement().querySelector('input[type=radio]') !== null }
    },
  ]
}

export { RadioControl }
