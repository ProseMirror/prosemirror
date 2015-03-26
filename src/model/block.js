// Primitive block-based transformations

import Pos from "./pos"
import Node from "./node"
import * as transform from "./transform"
import * as slice from "./slice"
import * as join_ from "./join"
import * as inline from "./inline"

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

transform.define("lift", function(doc, params) {
  let lift = canBeLifted(doc, params.pos, params.end || params.pos)
  if (!lift) return transform.identity(doc)
  let range = lift.range

  let before = new Pos(range.path, range.from)
  while (before.path.length > lift.path.length && before.offset == 0)
    before = before.shorten()
  let after = new Pos(range.path, range.to)
  while (after.path.length > lift.path.length && after.offset == doc.path(after.path).content.length)
    after = after.shorten(null, 1)

  let output = slice.before(doc, before)
  let result = new transform.Result(doc, output, before)
  let container = output.path(lift.path), size = container.content.length
  let source = doc.path(range.path)
  if (lift.unwrap) {
    for (let i = range.from; i < range.to; i++)
      container.pushFrom(source.content[i])
  } else {
    container.pushFrom(source, range.from, range.to)
  }

  result.chunk(after, pos => {
    let origOffset = pos.path[range.path.length]
    let offset = size - range.from
    if (lift.unwrap) {
      offset += pos.path[range.path.length + 1]
      for (let i = range.from; i < origOffset; i++)
        offset += source.content[i].content.length
    } else {
      offset += origOffset
    }
    let path = lift.path.concat(offset).concat(pos.path.slice(range.path.length + (lift.unwrap ? 2 : 1)))
    return new Pos(path, pos.offset)
  })

  join_.buildResult(result, after, output, lift.path.length,
                       slice.after(doc, after), after, true)

  return result
})

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

transform.define("join", function(doc, params) {
  let point = joinPoint(doc, params.pos)
  if (!point) return transform.identity(doc)

  let toJoined = point.path.concat(point.offset - 1)
  let output = slice.around(doc, new Pos(toJoined, 0))
  let parent = output.path(point.path)
  let target = parent.content[point.offset - 1]
  let size = target.content.length
  let from = parent.content[point.offset]
  parent.content.splice(point.offset, 1)
  target.pushFrom(from)

  let result = new transform.Result(doc, output, point)
  let after = new Pos(point.path, point.offset + 1)
  result.chunk(after, pos => {
    let offset = pos.path[toJoined.length] + size
    return new Pos(toJoined.concat(offset).concat(pos.path.slice(toJoined.length + 1)), pos.offset)
  })
  let endOfParent = point.shorten(null, 1)
  result.chunk(endOfParent, pos => pos.offsetAt(point.path.length, -1))

  return result
})

transform.define("wrap", function(doc, params) {
  let range = selectedSiblings(doc, params.pos, params.end || params.pos)
  let before = new Pos(range.path, range.from)
  let after = new Pos(range.path, range.to)

  let source = doc.path(range.path)
  let newNode = params.node || new Node(params.type, null, params.attrs)
  let wrapperType = newNode.type
  let connAround = Node.findConnection(source.type, newNode.type)
  let connInside = Node.findConnection(newNode.type, source.content[range.from].type)
  if (!connAround || !connInside) return transform.identity(doc)

  let output = slice.before(doc, before)
  let result = new transform.Result(doc, output, before)

  for (let pos = range.from; pos < range.to; pos++) {
    let newChild = source.content[pos]
    for (let i = connInside.length - 1; i >= 0; i--)
      newChild = new Node(connInside[i], [newChild])
    newNode.push(newChild)
  }
  for (let i = connAround.length - 1; i >= 0; i--)
    newNode = new Node(connAround[i], [newNode])

  output.path(range.path).push(newNode)
  let prefix = range.path.concat(range.from), suffix = []
  for (let i = 0; i < connAround.length; i++) prefix.push(0)
  for (let i = 0; i < connInside.length; i++) suffix.push(0)
  
  result.chunk(after, pos => {
    return new Pos(prefix.concat(pos.path[range.path.length] - range.from)
                     .concat(suffix).concat(pos.path.slice(range.path.length + 1)),
                   pos.offset)
  })

  join_.buildResult(result, after, output, range.path.length,
                    slice.after(doc, after), after, true)
  return result
})

transform.define("split", function(doc, params) {
  let depth = params.depth || 1, pos = params.pos
  let copy = slice.around(doc, pos)
  for (let cut, i = 0; i <= depth; i++) {
    let end = pos.path.length - i
    let target = copy.path(pos.path.slice(0, end))
    if (i == 0) {
      let {offset} = inline.splitInlineAt(target, pos.offset)
      let restContent = target.content.slice(offset)
      if (params.type)
        cut = new Node(params.type, restContent, params.attrs)
      else
        cut = target.copy(restContent)
      target.content.length = offset
    } else {
      let offset = pos.path[end] + 1
      if (i < depth) {
        cut = target.copy([cut].concat(target.content.slice(offset)))
        target.content.length = offset
      } else {
        target.content.splice(offset, 0, cut)
      }
    }
  }

  let result = new transform.Result(doc, copy, pos)
  let end = pos.shorten(pos.path.length - depth, 2)
  result.chunk(end, p => {
    let base = pos.path.length - depth
    let path = p.path.slice(0, base)
    for (var i = 0; i < depth; i++) {
      let a = p.path[base + i], b = pos.path[base + i]
      path.push(i ? a - b : a + 1)
      if (a != b) break
    }
    let offset = p.offset
    if (i == depth) offset -= pos.offset
    else i++
    path = path.concat(p.path.slice(base + i))
    return new Pos(path, offset)
  })
  return result
})

transform.define("insert", function(doc, params) {
  let pos = params.pos
  let copy = slice.around(doc, pos)
  let block = params.node || new Node(params.type, null, params.attrs)
  let parent = copy.path(pos.path)
  parent.content.splice(pos.offset, 0, block)
  let result = new transform.Result(doc, copy, pos)
  let depth = pos.path.length
  result.chunk(new Pos(pos.path, parent.content.length), pos => pos.offsetAt(depth, 1))
  return result
})

transform.define("remove", function(doc, params) {
  let pos = params.pos
  let copy = slice.around(doc, pos)
  let parent = copy.path(pos.path)
  parent.content.splice(pos.offset, 1)
  let result = new transform.Result(doc, copy, pos)
  let after = Pos.after(copy, pos)
  result.chunk(new Pos(pos.path, pos.offset + 1), _ => after)
  let depth = pos.path.length
  result.chunk(pos.shorten(null, 1), pos => pos.offsetAt(depth, -1))
  return result
})
