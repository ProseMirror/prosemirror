import {Pos, Node, slice, inline} from "../model"
import {Collapsed, defineTransform, Result, flatTransform} from "./transform"
import {glue} from "./replace"

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
  let found = canBeLifted(doc, from, to)
  if (found) {
    let range = found.range
    return {from: Pos.after(doc, new Pos(range.path, range.from)),
            to: Pos.before(doc, new Pos(range.path, range.to))}
  }
}

function canBeLifted(doc, from, to) {
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

function lift(doc, params) {
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
    if (!lift) return {name: "null"}
    let parent = result.before.path(lift.range.path)
    let joinLeft = lift.range.from > 0
    let joinRight = lift.range.to < parent.content.length
    return {name: "wrap", joinLeft: joinLeft, joinRight: joinRight,
            pos: result.map(params.pos), end: params.end && result.map(params.end),
            type: parent.type.name}
  }
})

function preciseJoinPoint(doc, pos) {
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

export function joinPoint(doc, pos) {
  var found = preciseJoinPoint(doc, pos)
  return found && Pos.after(doc, found)
}

defineTransform("join", {
  apply: join
})

function join(doc, params) {
  let point = preciseJoinPoint(doc, params.pos)
  if (!point || params.pos.cmp(Pos.after(doc, point))) return flatTransform(doc)

  let toJoined = point.path.concat(point.offset - 1)
  let output = slice.around(doc, toJoined)
  let parent = output.path(point.path)
  let target = parent.content[point.offset - 1]
  let from = parent.content[point.offset]

  let result = new Result(doc, output)
  let pathToFrom = point.path.concat(point.offset)
  result.chunk(new Pos(pathToFrom, 0), from.content.length,
               new Pos(point.path.concat(point.offset - 1), target.content.length))
  result.chunk(new Pos(point.path, point.offset + 1), parent.content.length - point.offset - 1,
               new Pos(point.path, point.offset))

  parent.content.splice(point.offset, 1)
  target.pushFrom(from)

  return result
}

export function wrappableRange(doc, from, to) {
  let range = selectedSiblings(doc, from, to)
  return {from: Pos.after(doc, new Pos(range.path, range.from)),
          to: Pos.before(doc, new Pos(range.path, range.to))}
}

defineTransform("wrap", {
  apply: wrap
})

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

defineTransform("split", {
  apply: split
})

function split(doc, params) {
  let depth = params.depth || 1, pos = params.pos
  let copy = slice.around(doc, pos.path)
  let result = new Result(doc, copy)

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
}

defineTransform("insert", {
  apply: insert
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

defineTransform("remove", {
  apply: remove
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
