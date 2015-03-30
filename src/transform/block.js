import {Pos, Node, slice, inline} from "../model"
import {defineTransform, Result, flatTransform} from "./transform"
import {joinAndTrack} from "./replace"

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

export function canBeLifted(doc, from, to) {
  let range = selectedSiblings(doc, from, to)
  let container = doc.path(range.path)
  let parentDepth, unwrap = false, innerType = container.type.contains
  for (;;) {
    parentDepth = -1
    for (let node = doc, i = 0; i < range.path.length; i++) {
      if (node.type.contains == innerType) parentDepth = i
      node = node.content[range.path[i]]
    }
    if (parentDepth > -1) return {
      range: range,
      path: range.path.slice(0, parentDepth),
      unwrap: unwrap
    }
    if (unwrap || !(innerType = canUnwrap(container, range.from, range.to))) return null
    unwrap = true
  }
}

defineTransform("lift", function(doc, params) {
  let lift = canBeLifted(doc, params.pos, params.end || params.pos)
  if (!lift) return flatTransform(doc)
  let range = lift.range

  let before = new Pos(range.path, range.from)
  while (before.path.length > lift.path.length && before.offset == 0)
    before = before.shorten()
  let after = new Pos(range.path, range.to)
  while (after.path.length > lift.path.length && after.offset == doc.path(after.path).content.length)
    after = after.shorten(null, 1)

  let output = slice.before(doc, before)
  let result = new Result(doc, output, before)
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

  joinAndTrack(result, after, output, lift.path.length,
               slice.after(doc, after), after, true)

  return result
})

// FIXME allow both searching up and searching down

export function joinPoint(doc, pos) {
  let joinDepth = -1
  for (let i = 0, parent = doc; i < pos.path.length; i++) {
    let index = pos.path[i]
    let type = parent.content[index].type
    if (index > 0 && parent.content[index - 1].type == type && type.contains != "inline")
      joinDepth = i
    parent = parent.content[index]
  }
  if (joinDepth > -1) return pos.shorten(joinDepth)
}

// FIXME pass in an already found join point

defineTransform("join", function(doc, params) {
  let point = joinPoint(doc, params.pos)
  if (!point) return flatTransform(doc)

  let toJoined = point.path.concat(point.offset - 1)
  let output = slice.around(doc, toJoined)
  let parent = output.path(point.path)
  let target = parent.content[point.offset - 1]
  let from = parent.content[point.offset]

  let result = new Result(doc, output, point)
  let pathToFrom = point.path.concat(point.offset)
  result.chunk(new Pos(pathToFrom, 0), from.content.length,
               new Pos(point.path.concat(point.offset - 1), target.content.length))
  result.chunk(new Pos(point.path, point.offset + 1), parent.content.length - point.offset - 1,
               new Pos(point.path, point.offset))

  parent.content.splice(point.offset, 1)
  target.pushFrom(from)

  return result
})

defineTransform("wrap", function(doc, params) {
  let range = selectedSiblings(doc, params.pos, params.end || params.pos)
  let before = new Pos(range.path, range.from)
  let after = new Pos(range.path, range.to)

  let source = doc.path(range.path)
  let newNode = params.node || new Node(params.type, null, params.attrs)
  let wrapperType = newNode.type
  let connAround = Node.findConnection(source.type, newNode.type)
  let connInside = Node.findConnection(newNode.type, source.content[range.from].type)
  if (!connAround || !connInside) return flatTransform(doc)

  let output = slice.before(doc, before)
  let result = new Result(doc, output, before)

  let prefix = range.path.concat(range.from), suffix
  for (let i = 0; i < connAround.length; i++) prefix.push(0)
  if (!connInside.length) {
    result.chunk(new Pos(range.path, range.from), range.to - range.from,
                 new Pos(prefix, 0))
  } else {
    suffix = []
    for (let i = 0; i < connInside.length; i++) suffix.push(0)
  }

  for (let pos = range.from; pos < range.to; pos++) {
    let newChild = source.content[pos]
    for (let i = connInside.length - 1; i >= 0; i--)
      newChild = new Node(connInside[i], [newChild])
    newNode.push(newChild)
    if (suffix) {
      let path = range.path.concat(pos)
      result.chunk(new Pos(path, 0), newChild.content.length,
                   new Pos(prefix.concat(pos - range.from).concat(suffix), 0))
    }
  }
  for (let i = connAround.length - 1; i >= 0; i--)
    newNode = new Node(connAround[i], [newNode])
  output.path(range.path).push(newNode)

  joinAndTrack(result, after, output, range.path.length,
               slice.after(doc, after), after, true)
  return result
})

defineTransform("split", function(doc, params) {
  let depth = params.depth || 1, pos = params.pos
  let copy = slice.around(doc, pos.path)
  let result = new Result(doc, copy, pos)

  let target = copy.path(pos.path)
  let adjusted = pos.path.slice()
  adjusted[adjusted.length - depth]++
  result.chunk(pos, target.size - pos.offset, new Pos(adjusted, 0))

  let {offset} = inline.splitInlineAt(target, pos.offset)
  let restContent = target.content.slice(offset), cut
  if (params.type)
    cut = new Node(params.type, restContent, params.attrs)
  else
    cut = target.copy(restContent)
  target.content.length = offset

  for (let i = 1; i <= depth; i++) {
    let end = pos.path.length - i
    let toTarget = pos.path.slice(0, end)
    let target = copy.path(toTarget)
    let offset = pos.path[end] + 1

    if (i < depth) {
      let adjusted = toTarget.slice()
      adjusted[adjusted.length - depth]++
      result.chunk(new Pos(toTarget, offset), target.content.length - offset,
                   new Pos(adjusted, 0))
      cut = target.copy([cut].concat(target.content.slice(offset)))
      target.content.length = offset
    } else {
      result.chunk(new Pos(toTarget, offset), target.content.length - offset,
                   new Pos(toTarget, offset + 1))
      target.content.splice(offset, 0, cut)
    }
  }

  return result
})

defineTransform("insert", function(doc, params) {
  let pos = params.pos
  let copy = slice.around(doc, pos.path)
  let result = new Result(doc, copy, pos)

  let block = params.node || new Node(params.type, null, params.attrs)
  let parent = copy.path(pos.path)
  result.chunk(pos, parent.content.length - pos.offset,
               new Pos(pos.path, pos.offset + 1))
  parent.content.splice(pos.offset, 0, block)

  return result
})

defineTransform("remove", function(doc, params) {
  let pos = params.pos
  let copy = slice.around(doc, pos.path)
  let result = new Result(doc, copy, pos)

  let parent = copy.path(pos.path)
  result.chunk(new Pos(pos.path, pos.offset + 1), parent.content.length - pos.offset - 1,
               pos)
  parent.content.splice(pos.offset, 1)
  return result
})
