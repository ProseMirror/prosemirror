import {Pos, Fragment} from "../model"

import {Transform} from "./transform"
import {Step, StepResult} from "./step"
import {PosMap, MovedRange, ReplacedRange} from "./map"

// !! **`split`**
//   : Split a block node at `pos`. The parameter, if given, may be
//     `{type, ?attrs}` object giving the node type and optionally the
//     attributes of the node created to hold the content after the
//     split.

Step.define("split", {
  apply(doc, step) {
    let pos = step.pos
    if (pos.depth == 0) return null

    let {path: parentPath, offset} = pos.shorten()
    let parent = doc.path(parentPath)
    let target = parent.child(offset), targetSize = target.size
    let {type: typeAfter, attrs: attrsAfter} = step.param || target

    let splitAt = pos.offset
    if ((splitAt == 0 && !target.type.canBeEmpty) || target.type.locked ||
        (splitAt == target.size) && !typeAfter.canBeEmpty)
      return null
    let newParent = parent.splice(offset, offset + 1,
                                  Fragment.from([target.slice(0, splitAt),
                                                 typeAfter.create(attrsAfter, target.content.slice(splitAt))]))
    let copy = doc.replaceDeep(parentPath, newParent)

    let dest = new Pos(parentPath.concat(offset + 1), 0)
    let map = new PosMap([new MovedRange(pos, targetSize - pos.offset, dest),
                          new MovedRange(new Pos(parentPath, offset + 1), newParent.size - 2 - offset,
                                         new Pos(parentPath, offset + 2))],
                         [new ReplacedRange(pos, pos, pos, dest, pos, pos.shorten(null, 1))])
    return new StepResult(copy, map)
  },
  invert(step, _oldDoc, map) {
    return new Step("join", step.pos, map.map(step.pos).pos)
  },
  paramToJSON(param) {
    return param && {type: param.type.name, attrs: param.attrs}
  },
  paramFromJSON(schema, json) {
    return json && {type: schema.nodeType(json.type), attrs: json.attrs}
  }
})

// :: (Pos, ?number, ?NodeType, ?Object) → Transform
// Split the node at the given position, and optionally, if `depth` is
// greater than one, any number of nodes above that. By default, the part
// split off will inherit the node type of the original node. This can
// be changed by passing `typeAfter` and `attrsAfter`.
Transform.prototype.split = function(pos, depth = 1, typeAfter, attrsAfter) {
  if (depth == 0) return this
  for (let i = 0;; i++) {
    this.step("split", null, null, pos, typeAfter && {type: typeAfter, attrs: attrsAfter})
    if (i == depth - 1) return this
    typeAfter = null
    pos = pos.shorten(null, 1)
  }
}

// :: (Pos, ?number) → Transform
// Split at the given position, _if_ that position isn't already at
// the start or end of a node. If `depth` is greater than one, also do
// so for parent positions above the given position.
Transform.prototype.splitIfNeeded = function(pos, depth = 1) {
  for (let off = 0; off < depth; off++) {
    let here = pos.shorten(pos.depth - off)
    if (here.offset && here.offset < this.doc.path(here.path).size)
      this.step("split", null, null, here)
  }
  return this
}
