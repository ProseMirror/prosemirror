import {ProseMirrorError} from "../util/error"

import {Fragment} from "./fragment"

// ;; Error type raised by `Node.replace` when given an invalid
// replacement.
export class ReplaceError extends ProseMirrorError {}

// ;; A slice represents a piece cut out of a larger document. It
// stores not only a fragment, but also the depth up to which nodes on
// both side are 'open' / cut through.
export class Slice {
  // :: (Fragment, number, number, ?Node)
  constructor(content, openLeft, openRight, possibleParent) {
    // :: Fragment The slice's content nodes.
    this.content = content
    // :: number The open depth at the start.
    this.openLeft = openLeft
    // :: number The open depth at the end.
    this.openRight = openRight
    this.possibleParent = possibleParent
  }

  // :: number
  // The size this slice would add when inserted into a document.
  get size() {
    return this.content.size - this.openLeft - this.openRight
  }

  // :: () → ?Object
  // Convert a slice to a JSON-serializable representation.
  toJSON() {
    if (!this.content.size) return null
    return {content: this.content.toJSON(),
            openLeft: this.openLeft,
            openRight: this.openRight}
  }

  // :: (Schema, ?Object) → Slice
  // Deserialize a slice from its JSON representation.
  static fromJSON(schema, json) {
    if (!json) return Slice.empty
    return new Slice(Fragment.fromJSON(schema, json.content), json.openLeft, json.openRight)
  }
}

// :: Slice
// The empty slice.
Slice.empty = new Slice(Fragment.empty, 0, 0)

export function replace($from, $to, slice) {
  if (slice.openLeft > $from.depth)
    throw new ReplaceError("Inserted content deeper than insertion position")
  if ($from.depth - slice.openLeft != $to.depth - slice.openRight)
    throw new ReplaceError("Inconsistent open depths")
  return replaceOuter($from, $to, slice, 0)
}

function replaceOuter($from, $to, slice, depth) {
  let index = $from.index(depth), node = $from.node(depth)
  if (index == $to.index(depth) && depth < $from.depth - slice.openLeft) {
    let inner = replaceOuter($from, $to, slice, depth + 1)
    return node.copy(node.content.replaceChild(index, inner))
  } else if (slice.content.size) {
    let {start, end} = prepareSliceForReplace(slice, $from)
    return close(node, replaceThreeWay($from, start, end, $to, depth))
  } else {
    return close(node, replaceTwoWay($from, $to, depth))
  }
}

function checkJoin(main, sub) {
  if (!main.type.canContainContent(sub.type))
    throw new ReplaceError("Cannot join " + sub.type.name + " onto " + main.type.name)
}

function joinable($before, $after, depth) {
  let node = $before.node(depth)
  checkJoin(node, $after.node(depth))
  return node
}

function addNode(child, target) {
  let last = target.length - 1
  if (last >= 0 && child.isText && child.sameMarkup(target[last]))
    target[last] = child.copy(target[last].text + child.text)
  else
    target.push(child)
}

function addRange($start, $end, depth, target) {
  let node = ($end || $start).node(depth)
  let startIndex = 0, endIndex = $end ? $end.index(depth) : node.childCount
  if ($start) {
    startIndex = $start.index(depth)
    if ($start.depth > depth) {
      startIndex++
    } else if (!$start.atNodeBoundary) {
      addNode($start.nodeAfter, target)
      startIndex++
    }
  }
  for (let i = startIndex; i < endIndex; i++) addNode(node.child(i), target)
  if ($end && $end.depth == depth && !$end.atNodeBoundary)
    addNode($end.nodeBefore, target)
}

function close(node, content) {
  if (!node.type.checkContent(content, node.attrs))
    throw new ReplaceError("Invalid content for node " + node.type.name)
  return node.copy(content)
}

function replaceThreeWay($from, $start, $end, $to, depth) {
  let openLeft = $from.depth > depth && joinable($from, $start, depth + 1)
  let openRight = $to.depth > depth && joinable($end, $to, depth + 1)

  let content = []
  addRange(null, $from, depth, content)
  if (openLeft && openRight && $start.index(depth) == $end.index(depth)) {
    checkJoin(openLeft, openRight)
    addNode(close(openLeft, replaceThreeWay($from, $start, $end, $to, depth + 1)), content)
  } else {
    if (openLeft)
      addNode(close(openLeft, replaceTwoWay($from, $start, depth + 1)), content)
    addRange($start, $end, depth, content)
    if (openRight)
      addNode(close(openRight, replaceTwoWay($end, $to, depth + 1)), content)
  }
  addRange($to, null, depth, content)
  return new Fragment(content)
}

function replaceTwoWay($from, $to, depth) {
  let content = []
  addRange(null, $from, depth, content)
  if ($from.depth > depth) {
    let type = joinable($from, $to, depth + 1)
    addNode(close(type, replaceTwoWay($from, $to, depth + 1)), content)
  }
  addRange($to, null, depth, content)
  return new Fragment(content)
}

function prepareSliceForReplace(slice, $along) {
  let extra = $along.depth - slice.openLeft, parent = $along.node(extra)
  if (!parent.type.canContainFragment(slice.content))
    throw new ReplaceError("Content " + slice.content + " cannot be placed in " + parent.type.name)
  let node = parent.copy(slice.content)
  for (let i = extra - 1; i >= 0; i--)
    node = $along.node(i).copy(Fragment.from(node))
  return {start: node.resolveNoCache(slice.openLeft + extra),
          end: node.resolveNoCache(node.content.size - slice.openRight - extra)}
}
