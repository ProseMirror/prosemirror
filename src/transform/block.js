import {Pos, Node, slice, inline} from "../model"
import {Collapsed, defineTransform, Result, flatTransform} from "./transform"
import {glue} from "./replace"
import {resolveTarget, resolvePos, describePos} from "./resolve"
import {sameArray} from "./util"

export function selectedSiblings(doc, from, to) {
  let len = Math.min(from.path.length, to.path.length)
  for (let i = 0;; i++) {
    let left = from.path[i], right = to.path[i]
    if (left != right || i == len - 1)
      return {path: from.path.slice(0, i), from: left, to: right + 1}
  }
}

function canUnwrap(container, from, to) {
  let type = container.content[from].type.contains
  for (let i = from + 1; i < to; i++)
    if (container.content[i].type.contains != type)
      return false
  return type
}

export function liftableRange(doc, from, to) {
  let range = selectedSiblings(doc, from, to)
  let found = canBeLifted(doc, range)
  if (found) {
    let fromDesc = describePos(doc, new Pos(range.path, range.from), "right")
    let toDesc = describePos(doc, new Pos(range.path, range.to), "left")
    return {name: "lift", pos: fromDesc.pos, info: fromDesc.info,
            end: toDesc.pos, endInfo: toDesc.info}
  }
}

function canBeLifted(doc, range) {
  let container = doc.path(range.path)
  let parentDepth, unwrap = false, innerType = container.type.contains
  for (;;) {
    parentDepth = -1
    for (let node = doc, i = 0; i < range.path.length; i++) {
      if (node.type.contains == innerType) parentDepth = i
      node = node.content[range.path[i]]
    }
    if (parentDepth > -1) return {path: range.path.slice(0, parentDepth),
                                  unwrap: unwrap}
    if (unwrap || !(innerType = canUnwrap(container, range.from, range.to))) return null
    unwrap = true
  }
}

function lift(doc, params) {
  let pos = resolvePos(doc, params.pos, params.info)
  let end = resolvePos(doc, params.end, params.endInfo)
  if (!sameArray(pos.path, end.path) || pos.offset >= end.offset)
    return flatTransform(doc)
  let range = {path: pos.path, from: pos.offset, to: end.offset}
  let lift = canBeLifted(doc, range)
  if (!lift) return flatTransform(doc)

  let before = new Pos(range.path, range.from)
  while (before.path.length > lift.path.length && before.offset == 0)
    before = before.shorten()
  let after = new Pos(range.path, range.to)
  while (after.path.length > lift.path.length && after.offset == doc.path(after.path).content.length)
    after = after.shorten(null, 1)

  let output = slice.before(doc, before)
  let result = new Result(doc, output)
  let container = output.path(lift.path), size = container.content.length
  let source = doc.path(range.path)
  if (lift.unwrap) {
    for (let i = range.from; i < range.to; i++) {
      let node = source.content[i], path = range.path.concat(i)
      result.chunk(new Pos(path, 0), node.content.length,
                   new Pos(lift.path, container.content.length))
      container.pushFrom(source.content[i])
    }
  } else {
    result.chunk(new Pos(range.path, range.from), range.to - range.from,
                 new Pos(lift.path, container.content.length))
    container.pushFrom(source, range.from, range.to)
  }

  glue(output, lift.path.length, slice.after(doc, after), after, {result: result})

  return result
}

defineTransform("lift", {
  apply: lift,
  invert(result, params) {
    let lift = canBeLifted(result.before, params.pos, params.end || params.pos)
    let parent = result.before.path(lift.range.path)
    let joinLeft = lift.range.from > 0
    let joinRight = lift.range.to < parent.content.length
    return {name: "wrap", joinLeft: joinLeft, joinRight: joinRight,
            pos: result.map(params.pos), end: params.end && result.map(params.end),
            type: parent.type.name, attrs: parent.attrs}
  }
})

function preciseJoinPoint(doc, pos, allowInline) {
  let joinDepth = -1
  for (let i = 0, parent = doc; i < pos.path.length; i++) {
    let index = pos.path[i]
    let type = parent.content[index].type
    if (index > 0 && parent.content[index - 1].type == type &&
        (allowInline || type.contains != "inline"))
      joinDepth = i
    parent = parent.content[index]
  }
  if (joinDepth > -1) return pos.shorten(joinDepth)
}

export function joinPoint(doc, pos, allowInline) {
  var found = preciseJoinPoint(doc, pos, allowInline)
  return found && Pos.after(doc, found)
}

function join(doc, params) {
  let point = preciseJoinPoint(doc, params.pos, params.allowInline)
  if (!point || params.pos.cmp(Pos.after(doc, point))) return flatTransform(doc)

  let toJoined = point.path.concat(point.offset - 1)
  let output = slice.around(doc, toJoined)
  let parent = output.path(point.path)
  let target = parent.content[point.offset - 1]
  let from = parent.content[point.offset]

  let result = new Result(doc, output)
  let pathToFrom = point.path.concat(point.offset)
  result.chunk(new Pos(pathToFrom, 0), from.maxOffset,
               new Pos(point.path.concat(point.offset - 1), target.maxOffset))
  result.chunk(new Pos(point.path, point.offset + 1), parent.content.length - point.offset - 1,
               new Pos(point.path, point.offset))

  parent.content.splice(point.offset, 1)
  let oldSize = target.content.length
  target.pushFrom(from)
  if (target.type.contains == "inline")
    inline.stitchTextNodes(target, oldSize)

  return result
}

defineTransform("join", {
  apply: join,
  invert(result, params) {
    let point = preciseJoinPoint(result.before, params.pos)
    return {name: "split", clean: true,
            pos: result.map(params.pos), depth: params.pos.path.length - point.path.length}
  }
})

export function wrappableRange(doc, from, to) {
  let range = selectedSiblings(doc, from, to)
  return {from: Pos.after(doc, new Pos(range.path, range.from)),
          to: Pos.before(doc, new Pos(range.path, range.to))}
}

function wrap(doc, params) {
  let range = selectedSiblings(doc, params.pos, params.end || params.pos)

  let source = doc.path(range.path)
  let newNode = params.node || new Node(params.type, null, params.attrs)
  let connAround = Node.findConnection(source.type, newNode.type)
  let connInside = Node.findConnection(newNode.type, source.content[range.from].type)
  if (!connAround || !connInside) return flatTransform(doc)
  let outerNode = newNode
  for (let i = connAround.length - 1; i >= 0; i--)
    outerNode = new Node(connAround[i], [outerNode])

  let joinLeft = params.joinLeft && range.from &&
      outerNode.sameMarkup(source.content[range.from - 1])
  let joinRight = params.joinRight && range.to < source.content.length &&
      outerNode.sameMarkup(source.content[range.to])

  let before = new Pos(range.path, range.from - (joinLeft ? 1 : 0))
  let after = new Pos(range.path, range.to + (joinRight ? 1 : 0))
  let output = slice.before(doc, before)
  let result = new Result(doc, output)

  let leftStart = 0
  if (joinLeft) {
    let joinSource = source.content[range.from - 1]
    outerNode.content = joinSource.content.concat(outerNode.content)
    leftStart = joinSource.content.length
  }
  let prefix = range.path.concat(range.from - (joinLeft ? 1 : 0)), suffix
  for (let i = 0; i < connAround.length; i++) {
    prefix.push(leftStart)
    leftStart = 0
  }
  if (!connInside.length) {
    result.chunk(new Pos(range.path, range.from), range.to - range.from, new Pos(prefix, leftStart))
  } else {
    suffix = []
    for (let i = 1; i < connInside.length; i++) suffix.push(0)
  }

  for (let pos = range.from; pos < range.to; pos++) {
    let newChild = source.content[pos]
    for (let i = connInside.length - 1; i >= 0; i--)
      newChild = new Node(connInside[i], [newChild])
    newNode.push(newChild)
    if (suffix) {
      let path = range.path.concat(pos)
      result.chunk(new Pos(range.path, pos), 1,
                   new Pos(prefix.concat(leftStart + pos - range.from).concat(suffix), 0))
    }
  }

  if (joinRight) {
    let joinSource = source.content[range.to]
    result.chunk(new Pos(range.path.concat(range.to), 0), joinSource.content.length,
                 new Pos(range.path.concat(range.from - (joinLeft ? 1 : 0)), outerNode.content.length))
    outerNode.pushFrom(joinSource)
  }

  output.path(range.path).push(outerNode)

  glue(output, range.path.length, slice.after(doc, after), after, {result: result})
  return result
}

defineTransform("wrap", {
  apply: wrap,
  invert(result, params) {
    return {name: "lift", pos: result.map(params.pos), end: params.end && result.map(params.end)}
  }
})

function split(doc, params) {
  let depth = params.depth || 1, pos = params.pos
  let copy = slice.around(doc, pos.path)
  let result = new Result(doc, copy)

  let target = copy.path(pos.path)
  let adjusted = pos.path.slice()
  adjusted[adjusted.length - depth]++
  result.chunk(pos, target.size - pos.offset, new Pos(adjusted, 0))

  let cut, removed = false
  if (pos.offset == 0 && params.clean) {
    removed = true
    cut = target
  } else if (!params.clean || pos.offset < offset) {
    let {offset} = inline.splitInlineAt(target, pos.offset)
    let restContent = target.content.slice(offset)
    if (params.type)
      cut = new Node(params.type, restContent, params.attrs)
    else
      cut = target.copy(restContent)
    target.content.length = offset
  }

  for (let i = 1; i <= depth; i++) {
    let end = pos.path.length - i
    let toTarget = pos.path.slice(0, end)
    let target = copy.path(toTarget)
    let offset = pos.path[end] + (removed ? 0 : 1)
    if (removed) target.content.splice(offset, 1)

    if (i < depth) {
      let adjusted = toTarget.slice()
      if (!removed) adjusted[adjusted.length - depth]++
      if (removed && params.clean && offset == 0) {
        removed = true
        if (cut) target.push(cut)
        cut = target
      } else if (!params.clean || offset < target.content.length || cut) {
        removed = false
        result.chunk(new Pos(toTarget, offset), target.content.length - offset,
                     new Pos(adjusted, 0))
        cut = target.copy((cut ? [cut] : []).concat(target.content.slice(offset)))
        target.content.length = offset
      } else {
        removed = false
        cut = null
      }
    } else {
      result.chunk(new Pos(toTarget, offset), target.content.length - offset,
                   new Pos(toTarget, offset + 1))
      if (cut) target.content.splice(offset, 0, cut)
    }
  }

  return result
}

defineTransform("split", {
  apply: split,
  invert(result, params) {
    return {name: "join", pos: result.map(params.pos), allowInline: (params.depth || 1) == 1}
  }
})

function insert(doc, params) {
  let pos = params.pos.shorten(null, params.direction == "before" ? 0 : 1)
  let copy = slice.around(doc, pos.path)
  let result = new Result(doc, copy)

  let block = params.node || new Node(params.type, null, params.attrs)
  let parent = copy.path(pos.path)
  parent.content.splice(pos.offset, 0, block)
  result.inserted = new Collapsed(pos, new Pos(pos.path, pos.offset + 1), Pos.near(copy, pos))
  result.inserted.chunk(pos, 1)
  result.chunk(pos, parent.content.length - pos.offset + 1,
               new Pos(pos.path, pos.offset + 1))

  return result
}

defineTransform("insert", {
  apply: insert,
  invert(result, params) {
    return {name: "remove", pos: result.map(params.pos), direction: params.direction}
  }
})

function remove(doc, params) {
  let pos = params.pos
  let dir = params.direction == "before" ? -1 : params.direction == "after" ? 1 : 0
  pos = pos.shorten(null, dir)
  if (dir == -1) {
    while (pos.offset < 0) {
      if (pos.path.length) pos = pos.shorten(null, -1)
      else return flatTransform(doc)
    }
  } else if (dir == 1) {
    while (pos.offset == doc.path(pos.path).content.length) {
      if (pos.path.length) pos = pos.shorten(null, 1)
      else return flatTransform(doc)
    }
  }
  
  let copy = slice.around(doc, pos.path)
  let result = new Result(doc, copy)

  let parent = copy.path(pos.path)
  parent.content.splice(pos.offset, 1)
  result.deleted = new Collapsed(pos, new Pos(pos.path, pos.offset + 1), Pos.near(copy, pos))
  result.deleted.chunk(pos, 1)
  result.chunk(new Pos(pos.path, pos.offset + 1), parent.content.length - pos.offset, pos)
  return result
}

defineTransform("remove", {
  apply: remove,
  invert(result, params) {
    let moved = result.deleted.ref.cmp(params.pos)
    let node = result.before.path(result.deleted.from.path).content[result.deleted.from.offset]
    return {name: "insert", pos: result.deleted.ref, direction: moved < 0 ? "after" : "before",
            node: node}
  }
})
