import {contains, browser} from "../dom"

import {posFromDOM, DOMAfterPos, DOMFromPos, coordsAtPos} from "./dompos"

// Track the state of the current editor selection. Keeps the editor
// selection in sync with the DOM selection by polling for changes,
// as there is no DOM event for DOM selection changes.
export class SelectionState {
  constructor(pm, range) {
    this.pm = pm
    // The current editor selection.
    this.range = range

    // The timeout ID for the poller when active.
    this.polling = null
    // Track the state of the DOM selection.
    this.lastAnchorNode = this.lastHeadNode = this.lastAnchorOffset = this.lastHeadOffset = null
    // The corresponding DOM node when a node selection is active.
    this.lastNode = null

    pm.content.addEventListener("focus", () => this.receivedFocus())

    this.poller = this.poller.bind(this)
  }

  // : (Selection, boolean)
  // Set the current selection and signal an event on the editor.
  setAndSignal(range, clearLast) {
    this.set(range, clearLast)
    // :: () #path=ProseMirror#events#selectionChange
    // Indicates that the editor's selection has changed.
    this.pm.signal("selectionChange")
  }

  // : (Selection, boolean)
  // Set the current selection.
  set(range, clearLast) {
    this.pm.ensureOperation({readSelection: false, selection: range})
    this.range = range
    if (clearLast !== false) this.lastAnchorNode = null
  }

  poller() {
    if (hasFocus(this.pm)) {
      if (!this.pm.operation) this.readFromDOM()
      this.polling = setTimeout(this.poller, 100)
    } else {
      this.polling = null
    }
  }

  startPolling() {
    clearTimeout(this.polling)
    this.polling = setTimeout(this.poller, 50)
  }

  fastPoll() {
    this.startPolling()
  }

  stopPolling() {
    clearTimeout(this.polling)
    this.polling = null
  }

  // : () → bool
  // Whether the DOM selection has changed from the last known state.
  domChanged() {
    let sel = window.getSelection()
    return sel.anchorNode != this.lastAnchorNode || sel.anchorOffset != this.lastAnchorOffset ||
      sel.focusNode != this.lastHeadNode || sel.focusOffset != this.lastHeadOffset
  }

  // Store the current state of the DOM selection.
  storeDOMState() {
    let sel = window.getSelection()
    this.lastAnchorNode = sel.anchorNode; this.lastAnchorOffset = sel.anchorOffset
    this.lastHeadNode = sel.focusNode; this.lastHeadOffset = sel.focusOffset
  }

  // : () → bool
  // When the DOM selection changes in a notable manner, modify the
  // current selection state to match.
  readFromDOM() {
    if (!hasFocus(this.pm) || !this.domChanged()) return false

    let {range, adjusted} = selectionFromDOM(this.pm, this.pm.doc, this.range.head)
    this.setAndSignal(range)

    if (range instanceof NodeSelection || adjusted) {
      this.toDOM()
    } else {
      this.clearNode()
      this.storeDOMState()
    }
    return true
  }

  toDOM(takeFocus) {
    if (!hasFocus(this.pm)) {
      if (!takeFocus) return
      // See https://bugzilla.mozilla.org/show_bug.cgi?id=921444
      else if (browser.gecko) this.pm.content.focus()
    }
    if (this.range instanceof NodeSelection)
      this.nodeToDOM()
    else
      this.rangeToDOM()
  }

  // Make changes to the DOM for a node selection.
  nodeToDOM() {
    let dom = DOMAfterPos(this.pm, this.range.from)
    if (dom != this.lastNode) {
      this.clearNode()
      dom.classList.add("ProseMirror-selectednode")
      this.pm.content.classList.add("ProseMirror-nodeselection")
      this.lastNode = dom
    }
    let range = document.createRange(), sel = window.getSelection()
    range.selectNode(dom)
    sel.removeAllRanges()
    sel.addRange(range)
    this.storeDOMState()
  }

  // Make changes to the DOM for a text selection.
  rangeToDOM() {
    this.clearNode()

    let anchor = DOMFromPos(this.pm, this.range.anchor)
    let head = DOMFromPos(this.pm, this.range.head)

    let sel = window.getSelection(), range = document.createRange()
    if (sel.extend) {
      range.setEnd(anchor.node, anchor.offset)
      range.collapse(false)
    } else {
      if (this.range.anchor > this.range.head) { let tmp = anchor; anchor = head; head = tmp }
      range.setEnd(head.node, head.offset)
      range.setStart(anchor.node, anchor.offset)
    }
    sel.removeAllRanges()
    sel.addRange(range)
    if (sel.extend)
      sel.extend(head.node, head.offset)
    this.storeDOMState()
  }

  // Clear all DOM statefulness of the last node selection.
  clearNode() {
    if (this.lastNode) {
      this.lastNode.classList.remove("ProseMirror-selectednode")
      this.pm.content.classList.remove("ProseMirror-nodeselection")
      this.lastNode = null
      return true
    }
  }

  receivedFocus() {
    if (this.polling == null) this.startPolling()
  }
}

// ;; An editor selection. Can be one of two selection types:
// `TextSelection` and `NodeSelection`. Both have the properties
// listed here, but also contain more information (such as the
// selected [node](#NodeSelection.node) or the
// [head](#TextSelection.head) and [anchor](#TextSelection.anchor)).
export class Selection {
  // :: number #path=Selection.prototype.from
  // The left-bound of the selection.

  // :: number #path=Selection.prototype.to
  // The right-bound of the selection.

  // :: bool #path=Selection.prototype.empty
  // True if the selection is an empty text selection (head an anchor
  // are the same).

  // :: (other: Selection) → bool #path=Selection.prototype.eq
  // Test whether the selection is the same as another selection.

  // :: (doc: Node, mapping: Mappable) → Selection #path=Selection.prototype.map
  // Map this selection through a [mappable](#Mappable) thing. `doc`
  // should be the new document, to which we are mapping.
}

// ;; A text selection represents a classical editor
// selection, with a head (the moving side) and anchor (immobile
// side), both of which point into textblock nodes. It can be empty (a
// regular cursor position).
export class TextSelection extends Selection {
  // :: (number, ?number)
  // Construct a text selection. When `head` is not given, it defaults
  // to `anchor`.
  constructor(anchor, head) {
    super()
    // :: number
    // The selection's immobile side (does not move when pressing
    // shift-arrow).
    this.anchor = anchor
    // :: number
    // The selection's mobile side (the side that moves when pressing
    // shift-arrow).
    this.head = head == null ? anchor : head
  }

  get inverted() { return this.anchor > this.head }
  get from() { return Math.min(this.head, this.anchor) }
  get to() { return Math.max(this.head, this.anchor) }
  get empty() { return this.anchor == this.head }

  eq(other) {
    return other instanceof TextSelection && other.head == this.head && other.anchor == this.anchor
  }

  map(doc, mapping) {
    let head = mapping.map(this.head)
    if (!doc.resolve(head).parent.isTextblock)
      return findSelectionNear(doc, head)
    let anchor = mapping.map(this.anchor)
    return new TextSelection(doc.resolve(anchor).parent.isTextblock ? anchor : head, head)
  }

  get token() {
    return new SelectionToken(TextSelection, this.anchor, this.head)
  }

  static mapToken(token, mapping) {
    return new SelectionToken(TextSelection, mapping.map(token.a), mapping.map(token.b))
  }

  static fromToken(token, doc) {
    if (!doc.resolve(token.b).parent.isTextblock)
      return findSelectionNear(doc, token.b)
    return new TextSelection(doc.resolve(token.a).parent.isTextblock ? token.a : token.b, token.b)
  }
}

// ;; A node selection is a selection that points at a
// single node. All nodes marked [selectable](#NodeType.selectable)
// can be the target of a node selection. In such an object, `from`
// and `to` point directly before and after the selected node.
export class NodeSelection extends Selection {
  // :: (number, number, Node)
  // Create a node selection. Does not verify the validity of its
  // arguments. Use `ProseMirror.setNodeSelection` for an easier,
  // error-checking way to create a node selection.
  constructor(from, to, node) {
    super()
    this.from = from
    this.to = to
    // :: Node The selected node.
    this.node = node
  }

  get empty() { return false }

  eq(other) {
    return other instanceof NodeSelection && this.from == other.from
  }

  map(doc, mapping) {
    let from = mapping.map(this.from, 1)
    let to = mapping.map(this.to, -1)
    let node = doc.nodeAt(from)
    if (node && to == from + node.nodeSize && node.type.selectable)
      return new NodeSelection(from, to, node)
    return findSelectionNear(doc, from)
  }

  get token() {
    return new SelectionToken(NodeSelection, this.from, this.to)
  }

  static mapToken(token, mapping) {
    return new SelectionToken(TextSelection, mapping.map(token.a, 1), mapping.map(token.b, -1))
  }

  static fromToken(token, doc) {
    let node = doc.nodeAt(token.a)
    if (node && token.b == token.a + node.nodeSize && node.type.selectable)
      return new NodeSelection(token.a, token.b, node)
    return findSelectionNear(doc, token.a)
  }
}

class SelectionToken {
  constructor(type, a, b) {
    this.type = type
    this.a = a
    this.b = b
  }
}

export function selectionFromDOM(pm, doc, oldHead, loose) {
  let sel = window.getSelection()
  let anchor = posFromDOM(pm, sel.anchorNode, sel.anchorOffset, loose)
  let head = sel.isCollapsed ? anchor : posFromDOM(pm, sel.focusNode, sel.focusOffset, loose)

  let range = findSelectionNear(doc, head, oldHead != null && oldHead < head ? 1 : -1)
  if (range instanceof TextSelection) {
    let selNearAnchor = findSelectionNear(doc, anchor, anchor > range.to ? -1 : 1, true)
    range = new TextSelection(selNearAnchor.anchor, range.head)
  } else if (anchor < range.from || anchor > range.to) {
    // If head falls on a node, but anchor falls outside of it,
    // create a text selection between them
    let inv = anchor > range.to
    range = new TextSelection(findSelectionNear(doc, anchor, inv ? -1 : 1, true).anchor,
                              findSelectionNear(doc, inv ? range.from : range.to, inv ? 1 : -1, true).head)
  }
  return {range, adjusted: head != range.head || anchor != range.anchor}
}

export function hasFocus(pm) {
  if (document.activeElement != pm.content) return false
  let sel = window.getSelection()
  return sel.rangeCount && contains(pm.content, sel.anchorNode)
}

// Try to find a selection inside the given node. `pos` points at the
// position where the search starts. When `text` is true, only return
// text selections.
function findSelectionIn(node, pos, index, dir, text) {
  for (let i = index - (dir > 0 ? 0 : 1); dir > 0 ? i < node.childCount : i >= 0; i += dir) {
    let child = node.child(i)
    if (child.isTextblock) return new TextSelection(pos + dir)
    if (child.type.contains) {
      let inner = findSelectionIn(child, pos + dir, dir < 0 ? child.childCount : 0, dir, text)
      if (inner) return inner
    } else if (!text && child.type.selectable) {
      return new NodeSelection(pos - (dir < 0 ? child.nodeSize : 0),
                               pos + (dir > 0 ? child.nodeSize : 0), child)
    }
    pos += child.nodeSize * dir
  }
}

// FIXME we'll need some awareness of text direction when scanning for selections

// Create a selection which is moved relative to a position in a
// given direction. When a selection isn't found at the given position,
// walks up the document tree one level and one step in the
// desired direction.
export function findSelectionFrom(doc, pos, dir, text) {
  let $pos = doc.resolve(pos)
  let inner = $pos.parent.isTextblock ? new TextSelection(pos)
      : findSelectionIn($pos.parent, pos, $pos.index($pos.depth), dir, text)
  if (inner) return inner

  for (let depth = $pos.depth - 1; depth >= 0; depth--) {
    let found = dir < 0
        ? findSelectionIn($pos.node(depth), $pos.before(depth + 1), $pos.index(depth), dir, text)
        : findSelectionIn($pos.node(depth), $pos.after(depth + 1), $pos.index(depth) + 1, dir, text)
    if (found) return found
  }
}

export function findSelectionNear(doc, pos, bias = 1, text) {
  let result = findSelectionFrom(doc, pos, bias, text) || findSelectionFrom(doc, pos, -bias, text)
  if (!result) throw new RangeError("Searching for selection in invalid document " + doc)
  return result
}

// Find the selection closest to the start of the given node. `pos`,
// if given, should point at the start of the node's content.
export function findSelectionAtStart(node, text) {
  return findSelectionIn(node, 0, 0, 1, text)
}

// Find the selection closest to the end of the given node.
export function findSelectionAtEnd(node, text) {
  return findSelectionIn(node, node.content.size, node.childCount, -1, text)
}

// : (ProseMirror, number, number)
// Whether vertical position motion in a given direction
// from a position would leave a text block.
export function verticalMotionLeavesTextblock(pm, pos, dir) {
  let $pos = pm.doc.resolve(pos)
  let dom = DOMAfterPos(pm, $pos.before($pos.depth))
  let coords = coordsAtPos(pm, pos)
  for (let child = dom.firstChild; child; child = child.nextSibling) {
    if (child.nodeType != 1) continue
    let boxes = child.getClientRects()
    for (let i = 0; i < boxes.length; i++) {
      let box = boxes[i]
      if (dir < 0 ? box.bottom < coords.top : box.top > coords.bottom)
        return false
    }
  }
  return true
}
