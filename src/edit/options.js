import {defaultSchema} from "../model"
import {ParamPrompt} from "../ui/prompt"

import {CommandSet, updateCommands} from "./command"

// An option encapsulates functionality for an editor instance,
// e.g. the amount of history events that the editor should hold
// onto or the document's schema.
class Option {
  constructor(defaultValue, update, updateOnInit) {
    this.defaultValue = defaultValue
    // A function that will be invoked with the option's old and new
    // value every time the option is [set](#ProseMirror.setOption).
    // This function should bootstrap option functionality.
    this.update = update
    this.updateOnInit = updateOnInit !== false
  }
}

const options = Object.create(null)

// :: (string, any, ?(pm: ProseMirror, newValue: any, oldValue: any, init: bool), bool)
// Define a new option. The `update` handler will be called with the
// option's old and new value every time the option is
// [changed](#ProseMirror.setOption). When `updateOnInit` is false, it
// will not be called on editor init, otherwise it is called with null as the old value,
// and a fourth argument of true.
export function defineOption(name, defaultValue, update, updateOnInit) {
  options[name] = new Option(defaultValue, update, updateOnInit)
}

// :: Schema #path=schema #kind=option
// The [schema](#Schema) that the editor's document should use.
defineOption("schema", defaultSchema)

// :: any #path=doc #kind=option
// The starting document. Usually a `Node`, but can be in another
// format when the `docFormat` option is also specified.
defineOption("doc", null, (pm, value) => pm.setDoc(value), false)

// :: ?string #path=docFormat #kind=option
// The format in which the `doc` option is given. Defaults to `null`
// (a raw `Node`).
defineOption("docFormat", null)

// :: ?union<DOMNode, (DOMNode)> #path=place #kind=option
// Determines the placement of the editor in the page. When `null`,
// the editor is not placed. When a DOM node is given, the editor is
// appended to that node. When a function is given, it is called
// with the editor's wrapping DOM node, and is expected to place it
// into the document.
defineOption("place", null)

// :: number #path=historyDepth #kind=option
// The amount of history events that are collected before the oldest
// events are discarded. Defaults to 100.
defineOption("historyDepth", 100)

// :: number #path=historyEventDelay #kind=option
// The amount of milliseconds that must pass between changes to
// start a new history event. Defaults to 500.
defineOption("historyEventDelay", 500)

// :: number #path=scrollThreshold #kind=option
// The minimum distance to keep between the position of document
// changes and the editor bounding rectangle before scrolling the view.
// Defaults to 0.
defineOption("scrollThreshold", 0)

// :: number #path=scrollMargin #kind=option
// Determines how far to scroll when the scroll threshold is
// surpassed. Defaults to 5.
defineOption("scrollMargin", 5)

// :: CommandSet #path=commands #kind=option
// Specifies the set of [commands](#Command) available in the editor
// (which in turn determines the base key bindings and items available
// in the menus). Defaults to `CommandSet.default`.
defineOption("commands", CommandSet.default, updateCommands)

// :: ParamPrompt #path=commandParamPrompt #kind=option
// A default [parameter prompting](#ui/prompt) class to use when a
// command is [executed](#ProseMirror.execCommand) without providing
// parameters.
defineOption("commandParamPrompt", ParamPrompt)

// :: ?string #path=label #kind=option
// The label of the editor. When set, the editable DOM node gets an
// `aria-label` attribute with this value.
defineOption("label", null)

// :: ?(string) → string #path=translate #kind=option
// Optional function to translate strings such as menu labels and prompts.
// When set, should be a function that takes a string as argument and returns
// a string, i.e. :: (string) → string
defineOption("translate", null) // FIXME create a way to explicitly force a menu redraw

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
  if (desc === undefined) throw new RangeError("Option '" + name + "' is not defined")
  if (desc.update === false) throw new RangeError("Option '" + name + "' can not be changed")
  let old = pm.options[name]
  pm.options[name] = value
  if (desc.update) desc.update(pm, value, old, false)
}
