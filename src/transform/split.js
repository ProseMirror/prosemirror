import {Slice, Fragment} from "../model"

import {Transform} from "./transform"
import {Step, StepResult} from "./step"
import {JoinStep} from "./join"
import {PosMap} from "./map"

// ;; Step to split a node.
export class SplitStep extends Step {
  // :: (number, ?string, ?Object)
  // Split the node at `pos`, optionally giving the split-off node the
  // type and attributes provide.
  constructor(pos, type, attrs) {
    super()
    this.pos = pos
    this.type = type
    this.attrs = attrs
  }

  apply(doc) {
    let $pos = doc.resolve(this.pos), parent = $pos.parent
    let cut = [parent.copy(), this.type ? doc.type.schema.nodes[this.type].create(this.attrs) : parent.copy()]
    return StepResult.fromReplace(doc, $pos.pos, $pos.pos, new Slice(Fragment.fromArray(cut), 1, 1))
  }

  posMap() {
    return new PosMap([this.pos, 0, 2])
  }

  invert() {
    return new JoinStep(this.pos + 1)
  }

  map(mapping) {
    let {deleted, pos} = mapping.mapResult(this.pos, 1)
    return deleted ? null : new SplitStep(pos, this.type, this.attrs)
  }

  static fromJSON(_schema, json) {
    return new SplitStep(json.pos, json.type, json.attrs)
  }
}

Step.register("split", SplitStep)

// :: (number, ?number, ?NodeType, ?Object) → Transform
// Split the node at the given position, and optionally, if `depth` is
// greater than one, any number of nodes above that. By default, the part
// split off will inherit the node type of the original node. This can
// be changed by passing `typeAfter` and `attrsAfter`.
Transform.prototype.split = function(pos, depth = 1, typeAfter, attrsAfter) {
  for (let i = 0; i < depth; i++) {
    this.step(new SplitStep(pos + i, typeAfter && typeAfter.name, attrsAfter))
    typeAfter = attrsAfter = null
  }
  return this
}
