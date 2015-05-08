import {defTest} from "../tests"
import ProseMirror from "../../src/edit/main"

let tempPM = null

export function tempEditor(options) {
  let space = document.querySelector("#workspace")
  if (tempPM) space.removeChild(tempPM.wrapper)
  if (!options) options = {}
  options.place = space
  return tempPM = new ProseMirror(options)
}

export function namespace(space, defaults) {
  return (name, f, options) => {
    if (defaults) for (let opt in defaults)
      if (!options.hasOwnProperty(opt)) options[opt] = defaults[opt]
    defTest(space + "_" + name, () => f(tempEditor(options)))
  }
}
