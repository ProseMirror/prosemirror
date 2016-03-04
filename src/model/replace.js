import {ProseMirrorError} from "../util/error"

import {Fragment} from "./fragment"

export class ReplaceError extends ProseMirrorError {}

export class Slice {
  constructor(content, openLeft, openRight) {
    this.content = content
    this.openLeft = openLeft
    this.openRight = openRight
  }

  toJSON() {
    if (!this.content.size) return null
    return {content: this.content.toJSON(),
            openLeft: this.openLeft,
            openRight: this.openRight}
  }

  static fromJSON(schema, json) {
    if (!json) return new Slice.empty
    return new Slice(Fragment.fromJSON(schema, json.content), json.openLeft, json.openRight)
  }
}

Slice.empty = new Slice(Fragment.empty, 0, 0)

export function replace(from, to, slice) {
  if (slice.openLeft > from.depth)
    throw new ReplaceError("Inserted content deeper than insertion position")
  if (from.depth - slice.openLeft != to.depth - slice.openRight)
    throw new ReplaceError("Inconsistent open depths")
  return replaceOuter(from, to, slice, 0)
}

function replaceOuter(from, to, slice, depth) {
  let index = from.index[depth], node = from.node[depth]
  if (index == to.index[depth] && depth < from.depth - slice.openFrom) {
    let inner = replaceOuter(from, to, slice, depth + 1)
    return node.copy(node.content.replace(index, inner))
  } else if (slice.content.size) {
    let {start, end} = prepareSliceForReplace(slice, from)
    return node.copy(replaceThreeWay(from, start, end, to, depth))
  } else {
    return node.copy(replaceTwoWay(from, to, depth))
  }
}

function checkJoin(main, sub) {
  if (!main.type.canContainContent(sub.type))
    throw new ReplaceError("Can not join " + sub.type.name + " onto " + main.type.name)
}

function joinType(before, after, depth) {
  let main = before.node[depth], sub = after.node[depth]
  if (before.offset[depth] == 0 && after.offset[depth] < sub.content.size) {
    let tmp = main
    main = sub
    sub = tmp
  }
  checkJoin(main, sub)
  return main
}

// FIXME use helper to merge text nodes, instead of .fromArray

function replaceThreeWay(from, start, end, to, depth) {
  let openLeft = from.depth > depth && joinType(from, start, depth + 1)
  let openRight = to.depth > depth && joinType(end, to, depth + 1)

  let content = from.node[depth].content.toArray(0, from.offset[depth])
  if (openLeft && openRight && start.index[depth] == end.index[depth]) {
    checkJoin(openLeft, openRight)
    let joined = replaceThreeWay(from, start, end, to, depth + 1)
    content.push(openLeft.type.close(openLeft.attrs, joined))
  } else {
    if (openLeft)
      content.push(openLeft.type.close(openLeft.attrs, replaceTwoWay(from, start, depth + 1)))
    let between = start.node[depth].content.toArray(start.offset[depth] + (openLeft ? start.node[depth + 1].size : 0),
                                                    end.offset[depth])
    for (let i = 0; i < between.length; i++) content.push(between[i])
    if (openRight)
      content.push(openRight.type.close(openRight.attrs, replaceTwoWay(end, to, depth + 1)))
  }
  let after = to.node[depth].content.toArray(to.offset[depth] + (openRight ? to.node[depth + 1].size : 0))
  for (let i = 0; i < after.length; i++) content.push(after[i])
  return Fragment.fromArray(content)
}

function replaceTwoWay(from, to, depth) {
  let content = from.node[depth].content.toArray(0, from.offset[depth])
  if (from.depth > depth) {
    let type = joinType(from, to, depth + 1)
    content.push(type.type.close(type.attrs, replaceTwoWay(from, to, depth + 1)))
  }
  let after = to.node[depth].content.toArray(to.offset[depth] + (from.depth > depth ? to.node[depth + 1].size : 0))
  for (let i = 0; i < after.length; i++) content.push(after[i])
  return Fragment.fromArray(content)
}

function prepareSliceForReplace(slice, along) {
  let extra = along.depth - slice.openLeft, parent = along.node[extra]
  if (!parent.type.canContainFragment(slice.content))
    throw new ReplaceError("Content " + slice + " can not be placed in " + parent.type.name)
  let node = parent.copy(slice.content)
  // FIXME only copy up to start depth? rest won't be used
  for (let i = extra - 1; i >= 0; i--)
    node = along.node[i].copy(Fragment.from(node))
  return {start: node.context(slice.openLeft + extra, false),
          end: node.context(node.content.size - slice.openRight - extra, false)}
}
