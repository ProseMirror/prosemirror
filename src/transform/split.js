import {Slice, Fragment} from "../model"

import {Transform} from "./transform"
import {Step, StepResult} from "./step"
import {PosMap} from "./map"

// !! **`split`**
//   : Split a block node at `pos`. The parameter, if given, may be
//     `{type, ?attrs}` object giving the node type and optionally the
//     attributes of the node created to hold the content after the
//     split.

Step.define("split", {
  apply(doc, step) {
    let $pos = doc.resolve(step.from), parent = $pos.parent
    let cut = [parent.copy(), step.param ? step.param.type.create(step.param.attrs) : parent.copy()]
    return StepResult.fromReplace(doc, $pos.pos, $pos.pos, new Slice(Fragment.fromArray(cut), 1, 1))
  },
  posMap(step) {
    return new PosMap([step.from, 0, 2])
  },
  invert(step) {
    return new Step("join", step.from, step.from + 2)
  },
  paramToJSON(param) {
    return param && {type: param.type.name, attrs: param.attrs}
  },
  paramFromJSON(schema, json) {
    return json && {type: schema.nodeType(json.type), attrs: json.attrs}
  }
})

// :: (number, ?number, ?NodeType, ?Object) → Transform
// Split the node at the given position, and optionally, if `depth` is
// greater than one, any number of nodes above that. By default, the part
// split off will inherit the node type of the original node. This can
// be changed by passing `typeAfter` and `attrsAfter`.
Transform.prototype.split = function(pos, depth = 1, typeAfter, attrsAfter) {
  for (let i = 0; i < depth; i++)
    this.step("split", pos + i, pos + i,
              i == 0 && typeAfter ? {type: typeAfter, attrs: attrsAfter} : null)
  return this
}
