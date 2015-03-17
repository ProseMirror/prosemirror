import defaultKeymap from "./defaultkeymap"
import {Range} from "./selection"
import {Node, Pos} from "../model"

class Option {
  constructor(defaultValue, update, updateOnInit) {
    this.defaultValue = defaultValue
    this.update = update
    this.updateOnInit = updateOnInit !== false
  }
}

const options = {
  __proto__: null,

  doc: new Option(new Node("doc", [new Node("paragraph")]), function(pm, value) {
    pm.update(value)
  }, false),

  place: new Option(null),

  keymap: new Option(defaultKeymap),

  extraKeymap: new Option(Object.create(null)),

  historyDepth: new Option(50),

  historyEventDelay: new Option(500),
}

export function defineOption(name, defaultValue, update, updateOnInit) {
  options[name] = new Option(defaultValue, update, updateOnInit)
}

export function parseOptions(obj) {
  let result = Object.create(null)
  for (let opt in options) {
    let inObj = obj && Object.prototype.hasOwnProperty.call(obj, opt)
    result[opt] = inObj ? obj[opt] : options[opt].defaultValue
  }
  return result
}

export function initOptions(pm) {
  for (var opt in options) {
    let desc = options[opt]
    if (desc.update && desc.updateOnInit)
      desc.update(pm, pm.options[opt], null, true)
  }
}
