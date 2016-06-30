const {Remapping, Transform} = require("../transform")

function rebaseSteps(doc, forward, steps, maps) {
  let remap = new Remapping(maps.map(m => m.invert()).reverse().concat(forward), maps.length)
  let transform = new Transform(doc)
  let positions = []

  for (let i = 0; i < steps.length; i++) {
    let step = steps[i].map(remap)
    let result = step && transform.maybeStep(step)
    remap.mapFrom--
    if (result && result.doc) {
      remap.appendMap(step.posMap(), remap.mapFrom)
      positions.push(transform.steps.length - 1)
    } else {
      positions.push(-1)
    }
  }
  return {doc: transform.doc, transform, mapping: remap, positions}
}
exports.rebaseSteps = rebaseSteps
