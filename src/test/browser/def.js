const {defTest} = require("../tests")
const {ProseMirror} = require("../../edit")
const {schema} = require("../../schema-basic")
const {baseKeymap} = require("../../commands")

let tempPMs = null

function tempEditors(options) {
  let space = document.querySelector("#workspace")
  if (tempPMs) {
    tempPMs.forEach(pm => space.removeChild(pm.wrapper))
    tempPMs = null
  }
  return tempPMs = options.map(options => {
    if (!options) options = {}
    options.place = space
    if (!options.doc) options.schema = schema
    if (!options.keymaps) options.keymaps = [baseKeymap]
    let pm = new ProseMirror(options)
    let a = options.doc && options.doc.tag && options.doc.tag.a
    if (a != null) {
      if (options.doc.resolve(a).parent.isTextblock) pm.setTextSelection(a, options.doc.tag.b)
      else pm.setNodeSelection(a)
    }
    return pm
  })
}
exports.tempEditors = tempEditors

function tempEditor(options) {
  return tempEditors([options])[0]
}
exports.tempEditor = tempEditor

function namespace(space, defaults) {
  return (name, f, options) => {
    if (!options) options = {}
    if (defaults) for (let opt in defaults)
      if (!options.hasOwnProperty(opt)) options[opt] = defaults[opt]
    defTest(space + "_" + name, () => f(tempEditor(options)))
  }
}
exports.namespace = namespace

function dispatch(pm, key) { pm.input.dispatchKey(key) }
exports.dispatch = dispatch
