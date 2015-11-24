import {defaultSchema} from "../model"

import {defaultKeymap} from "./commands"

class Option {
  constructor(defaultValue, update, updateOnInit) {
    this.defaultValue = defaultValue
    this.update = update
    this.updateOnInit = updateOnInit !== false
  }
}

const options = {
  __proto__: null,

  schema: new Option(defaultSchema, false, false),

  doc: new Option(null, function(pm, value) {
    pm.setDoc(value)
  }, false),

  docFormat: new Option(null),

  place: new Option(null),

  keymap: new Option(null, (pm, value) => {
    if (!value) pm.options.keymap = defaultKeymap(pm)
  }),

  historyDepth: new Option(50),

  historyEventDelay: new Option(500),

  commandParamHandler: new Option("default"),

  label: new Option(null)
}

export function defineOption(name, defaultValue, update, updateOnInit) {
  options[name] = new Option(defaultValue, update, updateOnInit)
}

export function parseOptions(obj) {
  let result = Object.create(null)
  let given = obj ? [obj].concat(obj.use || []) : []
  outer: for (let opt in options) {
    for (let i = 0; i < given.length; i++) {
      if (opt in given[i]) {
        result[opt] = given[i][opt]
        continue outer
      }
    }
    result[opt] = options[opt].defaultValue
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

export function setOption(pm, name, value) {
  let desc = options[name]
  if (desc.update === false) throw new Error("Option '" + name + "' can not be changed")
  let old = pm.options[name]
  pm.options[name] = value
  if (desc.update) desc.update(pm, value, old, false)
}
