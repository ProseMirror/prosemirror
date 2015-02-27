import Pos from "./pos"
import Node from "./node"
import * as slice from "./slice"

export default function replace(doc, from, to, repl = null, start = null, end = null) {
  from = reduceRight(doc, from)
  let result = slice.before(doc, from)
  to = reduceLeft(doc, to)
  let right = slice.after(doc, to)

  if (repl) {
    start = reduceRight(repl, start)
    end = reduceLeft(repl, end)
    let collapsed = [0]
    let middle = slice.between(repl, start, end, collapsed)

    join(result, from.path.length, middle, start.path.length - collapsed[0])
    join(result, end.path.length - collapsed[0] /* FIXME */, right, to.path.length)
  } else {
    join(result, from.path.length, right, to.path.length)
  }
  return result
}

function reduceLeft(node, pos) {
  if (pos.offset) return pos

  let max = 0
  for (let i = 0; i < pos.path.length; i++)
    if (pos.path[i]) max = i
  return new Pos(pos.path.slice(0, max), pos.path[max], false)
}

function reduceRight(node, pos) {
  let max = 0
  for (let i = 0; i < pos.path.length; i++) {
    let n = pos.path[i]
    if (n < node.content.length - 1) max = i
    node = node.content[pos.path[i]]
  }
  if (pos.offset < node.size) return pos
  return new Pos(pos.path.slice(0, max), pos.path[max] + 1, false)
}

function nodesLeft(doc, depth) {
  var nodes = []
  for (let node = doc, i = 0;; i++) {
    nodes.push(node)
    if (i == depth) return nodes
    node = node.content[0]
  }
}

function nodesRight(doc, depth) {
  var nodes = []
  for (let node = doc, i = 0;; i++) {
    nodes.push(node)
    if (i == depth) return nodes
    node = node.content[node.content.length - 1]
  }
}

// FIXME dedup
function copyInto(target, source, from = 0, to = source.content.length) {
  for (var i = from; i < to; i++)
    target.push(source.content[i])
}

function join(left, leftDepth, right, rightDepth) {
  var leftNodes = nodesRight(left, leftDepth)
  var rightNodes = nodesLeft(right, rightDepth)
  for (let iLeft = leftNodes.length - 1,
           iRight = rightNodes.length - 1; iRight >= 0; iRight--) {
    let node = rightNodes[iRight];
    if (node.content.length == 0) {
      if (iRight) rightNodes[iRight - 1].remove(node)
      continue
    }
    for (var i = iLeft; i >= 0; i--) {
      let other = leftNodes[i], before, after
      var contains = node.type.contains;
      if (contains == other.type.contains &&
          (contains == "block" || contains == "inline" || node.type == other.type) &&
          (i > 0 || iRight == 0)) {
        let start = other.content.length
        copyInto(other, node)
        // Stitch together adjacent text nodes
        if (node.type.contains == "inline" && start && other.content.length > start &&
            (before = other.content[start - 1]).type == Node.types.text &&
            (after = other.content[start]).type == Node.types.text &&
            Node.styles.compare(before.styles, after.styles))
          other.content.splice(start - 1, 2,
                               new Node.Inline(Node.types.text, before.styles, before.text + after.text))
        iLeft = i - 1
        if (iRight) rightNodes[iRight - 1].remove(node)
        break
      }
    }
  }
}
