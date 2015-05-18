import {Remapping, applyStep, mapStep} from "../transform"

export function rebaseChanges(doc, forward, changes) {
  let remap = new Remapping([], forward.slice())
  let rebased = []
  for (let i = 0; i < changes.length; i++) {
    let change = changes[i]
    let step = mapStep(change.step, remap)
    let result = step && applyStep(doc, step)
    if (result) {
      rebased.push({step: step, map: result.map, doc})
      doc = result.doc

      remap.corresponds[remap.back.length] = remap.forward.length
      remap.forward.push(result.map)
    }
    remap.back.push(change.map)
  }
  return {doc, changes: rebased, mapping: remap}
}
