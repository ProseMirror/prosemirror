import {Pos, Node} from "../model"

function findNodeFrom(doc, type, attrs, pos, dir) {
  let path = []
  type = Node.types[type]
  function search(node, onPos) {
    if (attrs ? Node.compareMarkup(type, node.type, attrs, node.attrs) : type == node.type)
      return path
    if (node.type.contains == "inline")
      return onPos ? null : false

    let n = onPos ? pos.path[path.length] : dir > 0 ? 0 : node.content.length - 1
    for (let i = n; dir < 0 ? i >= 0 : i < node.content.length; i += dir) {
      path.push(i)
      let result = search(node.content[i], onPos && i == n)
      if (result === false) return false
      if (result) return result
      path.pop()
    }
  }
  return search(doc, true)
}

function findNodeAround(doc, type, attrs, pos) {
  let found = null
  type = Node.types[type]
  for (let depth = 0, node = doc;; depth++) {
    if (attrs ? Node.compareMarkup(type, node.type, attrs, node.attrs) : type == node.type)
      found = depth
    if (depth == pos.path.length) break
    node = node.content[pos.path[depth]]
  }
  if (found != null) return pos.path.slice(0, found)
}

export function resolveTarget(doc, pos, info) {
  if (!info)
    return pos.path
  else if (info.dir == "around")
    return findNodeAround(doc, info.type, info.attrs, pos)
  else
    return findNodeFrom(doc, info.type, info.attrs, pos,
                        info.dir == "forward" ? 1 : -1)
}

export function resolvePos(doc, pos, info) {
  if (!info) return pos

  let target = resolveTarget(doc, pos, info.target)
  if (!target) return null

  if (info.side == "start")
    return new Pos(target, 0)
  else if (info.side == "end")
    return new Pos(target, doc.path(target).content.length)
  else
    return Pos.shorten(target, null, info.side == "before" ? 0 : 1)
}

function describeTargetLeft(doc, node, path) {
  let pos = Pos.before(doc, Pos.shorten(path, 0))
  if (pos) return {pos: pos, info: {type: node.type.name, attrs: node.attrs, dir: "after"}}
}

function describeTargetRight(doc, node, path) {
  let pos = Pos.after(doc, Pos.shorten(path, 1))
  if (pos) return {pos: pos, info: {type: node.type.name, attrs: node.attrs, dir: "before"}}
}

export function describeTarget(doc, path, from) {
  let node = doc.path(path)
  let inner = Pos.start(node)
  if (inner)
    return {pos: new Pos(path.concat(inner.path), inner.offset),
            info: {type: node.type.name, attrs: node.attrs, dir: "around"}}
  return (from == "right" && describeTargetRight(doc, node, path))
    || describeTargetLeft(doc, node, path) || describeTargetRight(doc, node, path)
}

export function describePos(doc, goal, from) {
  let parent = doc.path(goal.path)
  if (parent.type.contains == "inline") return {pos: goal, info: null}

  let targetInfo, pos, side
  if (!parent.content.length || (goal.offset == 0 && from == "left") ||
      (goal.offset == parent.content.length && from == "right")) {
    ({pos, info: targetInfo}) = describeTarget(doc, goal.path, from)
    side = goal.offset ? "end" : "start"
  } else if (from == "right") {
    ({pos, info: targetInfo}) = describeTarget(doc, goal.path.concat(goal.offset), from)
    side = "before"
  } else {
    ({pos, info: targetInfo}) = describeTarget(doc, goal.path.concat(goal.offset - 1), from)
    side = "after"
  }
  return {pos, info: {target: targetInfo, side: side}}
}
