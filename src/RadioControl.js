const ControlCollection = require('./ControlCollection.js')
const ControlBindings = ControlCollection.ControlBindings
const ControlConfiguration = ControlCollection.ControlConfiguration
const Control = ControlCollection.Control

class RadioControl extends Control{

/* No it's not as cool as it sounds.

    use Radio style selection controls.

    radio schema:

    let config = {
        name: "name_of_el",
        current:caller.get_value() === caller.select_value(i),
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
    let control = global.dudezilla.bindings.fetchGlobal(this.id);
    control.setValue(this.checked);
    control.eventLinkage(control.getLabel());
}
//export{Radio_Control};

module.exports.RadioControl = RadioControl