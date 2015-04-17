import {Pos, Node, inline, slice} from "../model"

import {Step} from "./transform"
import {del} from "./delete"
import {split} from "./split"

function samePathDepth(a, b) {
  for (let i = 0;; i++)
    if (i == a.path.length || i == b.path.length || a.path[i] != b.path[i])
      return i
}

class Frontier {
  constructor(doc, from, to) {
    this.doc = doc
    this.left = this.buildLeft(from)
    this.right = this.buildRight(to)
    let same = samePathDepth(from, to)
    this.bottom = new Pos(from.path.slice(0, same),
                          same == from.path.length ? from.offset : from.path[same] + 1)
  }

  buildLeft(pos) {
    let frontier = []
    for (let i = 0, node = this.doc;; i++) {
      let last = i == pos.path.length
      let n = last ? pos.offset : pos.path[i] + 1
      frontier.push({node, pos: new Pos(pos.path.slice(0, i), n)})
      if (last) return frontier
      node = node.content[n - 1]
    }
  }

  buildRight(pos) {
    let nodes = []
    for (let i = 0, node = this.doc;; i++) {
      let last = i == pos.path.length
      let n = last ? pos.offset : pos.path[i] + 1
      nodes.push({node, from: n, atEnd: n == node.maxOffset})
      if (last) return nodes
      node = node.content[n - 1]
    }
  }

  rightPos(depth) {
    let pos = this.bottom
    for (let i = this.botDepth; i < depth; i++)
      pos = new Pos(pos.path.concat(pos.offset), 0)
    return pos
  }

  get botDepth() {
    return this.bottom.path.length
  }
}

function nodesLeft(doc, depth) {
  let nodes = []
  for (let node = doc, i = 0;; i++) {
    nodes.push(node)
    if (i == depth) return nodes
    node = node.content[0]
  }
}

function matchInsertedContent(frontier, open, same) {
  let matches = [], searchLeft = frontier.left.length - 1, searchRight = open.length - 1
  let inner = open[searchRight]
  if (inner.type.block && inner.size &&
      frontier.left[searchLeft].node.type.block) {
    matches.push({source: searchRight, target: searchLeft, nodes: inner.content, size: inner.size})
    searchLeft--
    open[--searchRight].content.shift()
  }
  for (;;) {
    let node = open[searchRight], type = node.type, found = null
    let outside = searchRight <= same
    for (let i = searchLeft; i >= 0; i--) {
      let left = frontier.left[i].node
      if (outside ? left.type.contains == type.contains : left.type == type) {
        found = i
        break
      }
    }
    if (found != null && node.content.length) {
      matches.push({source: searchRight, target: found,
                    nodes: node.content, size: node.content.length})
      searchLeft = found - 1
    }
    if (found != null || node.content.length == 0) {
      if (outside) break
      open[searchRight - 1].content.shift()
    }
    searchRight--
  }
  return matches
}

function pushAll(target, elts) {
  for (let i = 0; i < elts.length; i++) target.push(elts[i])
}


function addInsertedContent(frontier, steps, source, start, end) {
  let remainder = slice.between(source, start, end)
  let nodes = nodesLeft(remainder, start.path.length)
  let sameInner = samePathDepth(start, end)
  let matches = matchInsertedContent(frontier, nodes, sameInner)

  for (let i = 0; i < matches.length; i++) {
    let match = matches[i]
    let pos = frontier.left[match.target].pos
    if (match.target < frontier.botDepth) {
      pushAll(steps, split(frontier.bottom, frontier.botDepth - match.target))
      pos = frontier.bottom = frontier.bottom.shorten(match.target, 1)
    }
    steps.push(new Step("insert", pos, null, match.nodes))
    if (match.target == frontier.botDepth)
      frontier.bottom = frontier.bottom.shift(match.size)
  }

  let lastMatch = matches[matches.length - 1]
  let depth = end.path.length
  if (matches.length > 1) depth = Math.min(depth, matches[matches.length - 2].source)

  frontier.left.length = frontier.botDepth + 1
  let ref = frontier.bottom
  for (let i = lastMatch.source + 1, node = nodes[lastMatch.source + 1]; i <= depth; i++) {
    let newRef = new Pos(ref.path.concat(ref.offset - 1), node.maxOffset)
    frontier.left.push({node, pos: newRef})
    node = node.content[newRef.offset]
    ref = newRef
  }
}

function joinFrontier(frontier, steps, upto) {
  for (let i = frontier.botDepth + 1; i < upto; i++) {
    let left = frontier.left[i].pos, last = left.path.length - 1
    let right = new Pos(left.path.slice(0, last).concat(left.path[last] + 1), 0)
    steps.push(new Step("join", left, right))
  }
}

function moveTextAcross(frontier, steps) {
  let depth = frontier.right.length
  let textStart = frontier.rightPos(depth - 1)
  let info = frontier.right[frontier.right.length - 1]
  let textEnd = textStart.shift(info.node.maxOffset - info.from)
  pushAll(steps, split(textEnd, depth - frontier.botDepth - 1))
  let stack = []
  for (let i = frontier.botDepth + 1; i < frontier.left.length; i++) {
    if (stack.length > 0 || i >= frontier.right.path ||
        !frontier.left[i].node.sameMarkup(frontier.right[i].node))
      stack.push(frontier.left[i].node.copy())
  }
  steps.push(new Step("ancestor", textStart, textEnd,
                      {depth: frontier.right.length - (frontier.left.length - stack.length),
                       wrappers: stack}))

  joinFrontier(frontier, steps, frontier.left.length)
  frontier.left.pop()
  frontier.right.pop()
}

export function replace(doc, from, to, source = null, start = null, end = null) {
  let steps = del(doc, from, to)
  let frontier = new Frontier(doc, from, to)

  // If there's a source to replace the range with, insert it,
  // updating the frontier's bottom and left side to reflect the
  // inserted content.
  if (source && start.cmp(end) < 0)
    addInsertedContent(frontier, steps, source, start, end)

  // Figure out which nodes along the frontier can be joined
  let joinTo = frontier.botDepth
  while (joinTo < frontier.left.length - 1 && joinTo < frontier.right.length - 1 &&
         frontier.left[joinTo + 1].node.sameMarkup(frontier.right[joinTo + 1].node))
    ++joinTo

  // If there's inline content at the left and right of the frontier,
  // move it from the right to the left so that the blocks are joined
  if (joinTo < frontier.right.length - 1 &&
      frontier.left[frontier.left.length - 1].node.type.block &&
      frontier.right[frontier.right.length - 1].node.type.block &&
      !frontier.right[frontier.right.length - 1].atEnd)
    moveTextAcross(frontier, steps)

  // And which pieces are the cut are empty, and may be deleted
  let delAt = frontier.right.length
  while (delAt > joinTo && frontier.right[delAt - 1].atEnd) --delAt

  if (delAt < frontier.right.length) {
    let delPos = frontier.rightPos(delAt - 1)
    steps.push(new Step("delete", delPos, delPos.shift(1)))
  }
  joinFrontier(frontier, steps, joinTo + 1)

//  for (let i = 0; i < steps.length; i++) console.log(steps[i])
  return steps
}
