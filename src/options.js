export var defaults = Object.create(null)

export function defineOption(name, defaultValue) {
  defaults[name] = defaultValue
}

export function init(obj) {
  let result = Object.create(null)
  for (let opt in defaultOptions)
    result[opt] = obj && Object.prototype.hasOwnProperty.call(obj, opt) ? obj[opt] : defaults[opt]
  return result
}

defineOption("value", "")

defineOption("place", null)

//defineOption("keymap", require("./defaultkeymap"))

defineOption("historyDepth", 50)

defineOption("historyEventDelay", 500)
