import Pos from "./pos"
import Node from "./node"
import * as slice from "./slice"
import * as join from "./join"
import * as transform from "./transform"
import {stitchTextNodes} from "./inline"

transform.define("replace", function(doc, params) {
  let from = params.pos, to = params.end || params.pos

  let output = slice.before(doc, from)
  let result = new transform.Result(doc, output, from)
  let right = slice.after(doc, to)

  if (params.source) {
    let start = params.from, end = params.to
    let collapsed = [0]
    let middle = slice.between(params.source, start, end, collapsed)

    let endPos = join.trackEnd(output, from.path.length, middle, start.path.length - collapsed[0]) || params.to
    let endDepth = endPos.path.length
    if (!endPos.isBlock) endPos = Pos.end(output)
    result.chunk(to, _ => endPos)
    join.buildResult(result, to, output, end.path.length - collapsed[0] + endDepth, right, to)
  } else {
    let endPos = params.pos
    if (params.text) {
      let block = output.path(from.path), end = block.content.length
      if (!block.type.contains == "inline")
        throw new Error("Can not insert text at a non-inline position")
      let styles = end ? block.content[end - 1].styles : Node.empty
      block.content.push(new Node.Inline(Node.types.text, styles, params.text))
      stitchTextNodes(block, end)
      endPos = new Pos(endPos.path, endPos.offset + params.text.length)
    }
    result.chunk(to, _ => endPos)
    join.buildResult(result, to, output, from.path.length, right, to)
  }

  return result
})
