import {defTest} from "../tests"
import {ProseMirror} from "../../src/edit/main"

let tempPMs = null

export function tempEditors(options) {
  let space = document.querySelector("#workspace")
  if (tempPMs) {
    tempPMs.forEach(pm => space.removeChild(pm.wrapper))
    tempPMs = null
  }
  return tempPMs = options.map(options => {
    if (!options) options = {}
    options.place = space
    let pm = new ProseMirror(options)
    let a = options.doc && options.doc.tag && options.doc.tag.a
    if (a) {
      if (options.doc.path(a.path).isTextblock) pm.setSelection(a, options.doc.tag.b)
      else pm.setNodeSelection(a)
    }
    return pm
  })
}

export function tempEditor(options) {
  return tempEditors([options])[0]
}

export function namespace(space, defaults) {
  return (name, f, options) => {
    if (!options) options = {}
    if (defaults) for (let opt in defaults)
      if (!options.hasOwnProperty(opt)) options[opt] = defaults[opt]
    defTest(space + "_" + name, () => f(tempEditor(options)))
  }
}
