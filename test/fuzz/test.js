import {Node, style} from "../../src/model"
import {Transform, Remapping} from "../../src/transform"
import {cmpStr, cmpNode} from "../cmp"
import {randomPos} from "./pos"

export function nodeSize(node) {
  if (node.isTextblock) return node.maxOffset
  if (node.offset) return node.offset
  let sum = 0
  for (let i = node.length; i >= 0; i--) sum += nodeSize(node.child(i))
  return sum
}

export function sizeBetween(doc, from, to) {
  function count(node, from, to, depth) {
    if (node.isTextblock) {
      return (to ? to.offset : node.maxOffset) - (from ? from.offset : 0)
    } else {
      let sum = 0, start, end
      if (from) {
        if (from.depth > depth) {
          let n = from.path[depth]
          if (to && to.depth > depth && to.path[depth] == n)
            return count(node.child(n), from, to, depth + 1)
          sum += count(node.child(n), from, null, depth + 1)
          start = n + 1
        } else {
          start = from.offset
        }
      } else {
        start = 0
      }
      if (to) {
        if (to.depth > depth) {
          end = to.path[depth]
          sum += count(node.child(end), null, to, depth + 1)
        } else {
          end = to.offset
        }
      } else {
        end = node.length
      }
      for (let i = start; i < end; i++) sum += nodeSize(node.child(i))
      return sum
    }
  }
  return count(doc, from, to, 0)
}

export function checkInvariants(node) {
  for (let i = 0; i < node.length; i++) {
    let child = node.child(i)
    if (node.type.canContain(child.type))
      throw new Error(child.type.name + " node in " + node.type.name)
    if (node.isTextblock && child.isText) {
      if (i) {
        let prev = node.child(i - 1)
        if (prev.isText && style.sameSet(prev.styles, child.styles))
          throw new Error("identically styled ajacent text nodes")
      }
      if (i < node.length - 1) {
        let next = node.child(i + 1)
        if (next.isText && style.sameSet(next.styles, child.styles))
          throw new Error("identically styled ajacent text nodes")
      }
    }
    checkInvariants(child)
  }
}

const mapTestCount = 10

export function testTransform(tr) {
  checkInvariants(tr.doc)
  let inverted = new Transform(tr.doc)
  for (let i = tr.steps.length - 1; i >= 0; i--)
    inverted.step(tr.steps[i].invert(tr.docs[i], tr.maps[i]))
  cmpNode(inverted.doc, tr.docs[0], "invert to original")
  let remap = new Remapping
  for (let i = 0, j = tr.steps.length - 1; j >= 0; i++, j--) {
    let id = remap.addToFront(tr.maps[j])
    remap.addToBack(inverted.maps[i], id)
  }
  for (let i = 0; i < mapTestCount; i++) {
    let pos = randomPos(tr.docs[0])
    if (!pos) continue
    cmpStr(remap.map(pos).pos, pos, "mapped back and forth")
  }
}
