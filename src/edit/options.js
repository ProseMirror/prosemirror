import defaultKeymap from "./defaultkeymap"
import {Node} from "../model"

export var defaults = Object.create(null)

export function defineOption(name, defaultValue) {
  defaults[name] = defaultValue
}

export function init(obj) {
  let result = Object.create(null)
  for (let opt in defaults)
    result[opt] = obj && Object.prototype.hasOwnProperty.call(obj, opt) ? obj[opt] : defaults[opt]
  return result
}

defineOption("doc", new Node("doc", [new Node("paragraph")]))

defineOption("place", null)

defineOption("keymap", defaultKeymap)

defineOption("extraKeymap", {})

defineOption("historyDepth", 50)

defineOption("historyEventDelay", 500)

defineOption("modules", Object.create(null))
