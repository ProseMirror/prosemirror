import {Pos} from "../model"

import {TransformResult, Transform} from "./transform"
import {defineStep, Step} from "./step"
import {PosMap, MovedRange, ReplacedRange} from "./map"

defineStep("split", {
  apply(doc, step) {
    let pos = step.pos
    if (pos.depth == 0) return null

    let {path: parentPath, offset} = pos.shorten()
    let parent = doc.path(parentPath)
    let target = parent.child(offset), targetSize = target.maxOffset
    let {type: typeAfter, attrs: attrsAfter} = step.param || target

    let splitAt = pos.offset
    if ((splitAt == 0 && !target.type.canBeEmpty) || target.type.locked ||
        (splitAt == target.maxOffset) && !typeAfter.canBeEmpty)
      return null
    let newParent = parent.splice(offset, offset + 1,
                                  [target.copy(target.slice(0, splitAt)),
                                   typeAfter.create(attrsAfter, target.slice(splitAt))])
    let copy = doc.replaceDeep(parentPath, newParent)

    let dest = new Pos(parentPath.concat(offset + 1), 0)
    let map = new PosMap([new MovedRange(pos, targetSize - pos.offset, dest),
                          new MovedRange(new Pos(parentPath, offset + 1), newParent.length - 2 - offset,
                                         new Pos(parentPath, offset + 2))],
                         [new ReplacedRange(pos, pos, pos, dest, pos, pos.shorten(null, 1))])
    return new TransformResult(copy, map)
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

Transform.prototype.split = function(pos, depth = 1, typeAfter, attrsAfter) {
  if (depth == 0) return this
  for (let i = 0;; i++) {
    this.step("split", null, null, pos, typeAfter && {type: typeAfter, attrs: attrsAfter})
    if (i == depth - 1) return this
    typeAfter = null
    pos = pos.shorten(null, 1)
  }
}

Transform.prototype.splitIfNeeded = function(pos, depth = 1) {
  for (let off = 0; off < depth; off++) {
    let here = pos.shorten(pos.depth - off)
    if (here.offset && here.offset < this.doc.path(here.path).maxOffset)
      this.step("split", null, null, here)
  }
  return this
}
