import {Pos, Node, inline} from "../model"

import {defineTransform, Result, Step} from "./transform"
import {copyTo} from "./tree"
import {PosMap, MovedRange, CollapsedRange} from "./map"

defineTransform("join", {
  apply(doc, data) {
    let before = doc.path(data.from.path)
    let after = doc.path(data.to.path)
    if (data.from.offset < before.maxOffset || data.to.offset > 0 ||
        before.type.contains != after.type.contains) return null
    let pFrom = data.from.path, pTo = data.to.path
    let last = pFrom.length - 1, offset = pFrom[last] + 1
    if (pFrom.length != pTo.length || pFrom.length == 0 || offset != pTo[last]) return null
    for (let i = 0; i < last; i++) if (pFrom[i] != pTo[i]) return null

    let targetPath = pFrom.slice(0, last)
    let copy = copyTo(doc, targetPath)
    let target = copy.path(targetPath), oldSize = target.content.length
    let joined = new Node(before.type, before.content.concat(after.content), before.attrs)
    if (joined.type.block)
      inline.stitchTextNodes(joined, before.content.length)
    target.content.splice(offset - 1, 2, joined)

    let map = new PosMap([new MovedRange(data.to, after.maxOffset, data.from, "delete"),
                          new MovedRange(new Pos(targetPath, offset + 1), oldSize - offset - 1, new Pos(targetPath, offset))],
                         [new CollapsedRange(data.from, data.to, data.from)])
    return new Result(doc, copy, map)
  },
  invert: function(result, data) {
    return new Step("split", data.from)
  }
})

export function join(doc, at) {
  let parent = doc.path(at.path)
  if (at.offset == 0 || at.offset == parent.content.length) return []
  return [new Step("join", new Pos(at.path.concat(at.offset - 1), parent.content[at.offset - 1].maxOffset),
                   new Pos(at.path.concat(at.offset), 0))]
}
