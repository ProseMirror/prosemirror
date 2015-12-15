import {Remapping, Transform} from "../transform"

export function rebaseSteps(doc, forward, steps, maps) {
  let remap = new Remapping([], forward.slice())
  let transform = new Transform(doc)
  let positions = []

  for (let i = 0; i < steps.length; i++) {
    let step = steps[i].map(remap)
    let result = step && transform.step(step)
    let id = remap.addToFront(maps[i].invert())
    if (result) {
      remap.addToBack(result.map, id)
      positions.push(transform.steps.length - 1)
    } else {
      positions.push(-1)
    }
  }
  return {doc: transform.doc, transform, mapping: remap, positions}
}
