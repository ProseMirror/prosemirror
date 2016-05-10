import {Slice, Fragment} from "../model"

import {Transform} from "./transform"
import {ReplaceStep} from "./replace"

// :: (number, ?number, ?NodeType, ?Object) → Transform
// Split the node at the given position, and optionally, if `depth` is
// greater than one, any number of nodes above that. By default, the part
// split off will inherit the node type of the original node. This can
// be changed by passing `typeAfter` and `attrsAfter`.
Transform.prototype.split = function(pos, depth = 1, typeAfter, attrsAfter) {
  let $pos = this.doc.resolve(pos), before = Fragment.empty, after = Fragment.empty
  for (let d = $pos.depth, e = $pos.depth - depth; d > e; d--) {
    before = Fragment.from($pos.node(d).copy(before))
    after = Fragment.from(typeAfter ? typeAfter.create(attrsAfter, after) : $pos.node(d).copy(after))
    typeAfter = null
  }
  return this.step(new ReplaceStep(pos, pos, new Slice(before.append(after), depth, depth, true)))
}
