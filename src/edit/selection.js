import {Pos} from "../model"
import {ProseMirrorError} from "../util/error"
import {contains, browser} from "../dom"

import {posFromDOM, pathToDOM, DOMFromPos, coordsAtPos} from "./dompos"

// ;; Error type used to signal selection-related problems.
export class SelectionError extends ProseMirrorError {}

// Track the state of the current editor selection. Keeps the editor
// selection in sync with the DOM selection by polling for changes,
// as there is no DOM event for DOM selection changes.
export class SelectionState {
  constructor(pm, range) {
    this.pm = pm
    // The current editor selection.
    this.range = range

    this.lastNonNodePos = null

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
    this.pm.ensureOperation({readSelection: false})
    this.range = range
    if (!range.node) this.lastNonNodePos = null
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
    if (this.pm.input.composing || !hasFocus(this.pm) || !this.domChanged()) return false

    let sel = window.getSelection(), doc = this.pm.doc
    let anchor = posFromDOM(this.pm, sel.anchorNode, sel.anchorOffset)
    let head = sel.isCollapsed ? anchor : posFromDOM(this.pm, sel.focusNode, sel.focusOffset)

    let newRange = findSelectionNear(doc, head, this.range.head && this.range.head.cmp(head) < 0 ? -1 : 1)
    if (newRange instanceof TextSelection && doc.path(anchor.path).isTextblock)
      newRange = new TextSelection(anchor, newRange.head)
    this.setAndSignal(newRange)

    if (newRange instanceof NodeSelection || newRange.head.cmp(head) || newRange.anchor.cmp(anchor)) {
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
    let dom = pathToDOM(this.pm.content, this.range.from.toPath())
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

    let anchor = DOMFromPos(this.pm.content, this.range.anchor)
    let head = DOMFromPos(this.pm.content, this.range.head)

    let sel = window.getSelection(), range = document.createRange()
    if (sel.extend) {
      range.setEnd(anchor.node, anchor.offset)
      range.collapse(false)
    } else {
      if (this.range.anchor.cmp(this.range.head) > 0) { let tmp = anchor; anchor = head; head = tmp }
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
  // :: Pos #path=Selection.prototype.from
  // The left-bound of the selection.

  // :: Pos #path=Selection.prototype.to
  // The right-bound of the selection.

  // :: bool #path=Selection.empty
  // True if the selection is an empty text selection (head an anchor
  // are the same).

  // :: (other: Selection) → bool #path=Selection.eq
  // Test whether the selection is the same as another selection.

  // :: (doc: Node, mapping: Mappable) → Selection #path=Selection.map
  // Map this selection through a [mappable](#Mappable) thing. `doc`
  // should be the new document, to which we are mapping.
}

// ;; A text selection represents a classical editor
// selection, with a head (the moving side) and anchor (immobile
// side), both of which point into textblock nodes. It can be empty (a
// regular cursor position).
export class TextSelection extends Selection {
  // :: (Pos, ?Pos)
  // Construct a text selection. When `head` is not given, it defaults
  // to `anchor`.
  constructor(anchor, head) {
    super()
    // :: Pos
    // The selection's immobile side (does not move when pressing
    // shift-arrow).
    this.anchor = anchor
    // :: Pos
    // The selection's mobile side (the side that moves when pressing
    // shift-arrow).
    this.head = head || anchor
  }

  get inverted() { return this.anchor.cmp(this.head) > 0 }
  get from() { return this.inverted ? this.head : this.anchor }
  get to() { return this.inverted ? this.anchor : this.head }
  get empty() { return this.anchor.cmp(this.head) == 0 }

  eq(other) {
    return other instanceof TextSelection && !other.head.cmp(this.head) && !other.anchor.cmp(this.anchor)
  }

  map(doc, mapping) {
    let head = mapping.map(this.head).pos
    if (!doc.path(head.path).isTextblock)
      return findSelectionNear(doc, head)
    let anchor = mapping.map(this.anchor).pos
    return new TextSelection(doc.path(anchor.path).isTextblock ? anchor : head, head)
  }
}

// ;; A node selection is a selection that points at a
// single node. All nodes marked [selectable](#NodeType.selectable)
// can be the target of a node selection. In such an object, `from`
// and `to` point directly before and after the selected node.
export class NodeSelection extends Selection {
  // :: (Pos, Pos, Node)
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
    return other instanceof NodeSelection && !this.from.cmp(other.from)
  }

  map(doc, mapping) {
    let from = mapping.map(this.from, 1).pos
    let to = mapping.map(this.to, -1).pos
    if (Pos.samePath(from.path, to.path) && from.offset == to.offset - 1) {
      let node = doc.nodeAfter(from)
      if (node.type.selectable) return new NodeSelection(from, to, node)
    }
    return findSelectionNear(doc, from)
  }
}

export function rangeFromDOMLoose(pm) {
  if (!hasFocus(pm)) return null
  let sel = window.getSelection()
  return new TextSelection(posFromDOM(pm, sel.anchorNode, sel.anchorOffset, true),
                           posFromDOM(pm, sel.focusNode, sel.focusOffset, true))
}

export function hasFocus(pm) {
  if (document.activeElement != pm.content) return false
  let sel = window.getSelection()
  return sel.rangeCount && contains(pm.content, sel.anchorNode)
}

// Create a selection inside the node at the given path coming
// from a given direction.
function findSelectionIn(doc, path, offset, dir, text) {
  let node = doc.path(path)
  if (node.isTextblock) return new TextSelection(new Pos(path, offset))

  // Iteratve over child nodes recursively coming from the given
  // direction and return the first viable selection.
  for (let i = offset + (dir > 0 ? 0 : -1); dir > 0 ? i < node.size : i >= 0; i += dir) {
    let child = node.child(i)
    if (!text && child.type.contains == null && child.type.selectable)
      return new NodeSelection(new Pos(path, i), new Pos(path, i + 1), child)
    path.push(i)
    let inside = findSelectionIn(doc, path, dir < 0 ? child.size : 0, dir, text)
    if (inside) return inside
    path.pop()
  }
}

// FIXME we'll need some awareness of bidi motion when determining block start and end

// Create a selection which is moved relative to a position in a
// given direction. When a selection isn't found at the given position,
// walks up the document tree one level and one step in the
// desired direction.
export function findSelectionFrom(doc, pos, dir, text) {
  for (let path = pos.path.slice(), offset = pos.offset;;) {
    let found = findSelectionIn(doc, path, offset, dir, text)
    if (found) return found
    if (!path.length) break
    offset = path.pop() + (dir > 0 ? 1 : 0)
  }
}

export function findSelectionNear(doc, pos, bias = 1, text) {
  let result = findSelectionFrom(doc, pos, bias, text) || findSelectionFrom(doc, pos, -bias, text)
  if (!result) SelectionError("Searching for selection in invalid document " + doc)
  return result
}

// Create a selection in a document at the beginning of the node
// at a given path.
// TODO should we change the variable here to "doc" for clarity?
export function findSelectionAtStart(node, path = [], text) {
  return findSelectionIn(node, path.slice(), 0, 1, text)
}

// Create a selection in a document at the end of the node
// at a given path.
// TODO should we change the variable here to "doc" for clarity?
export function findSelectionAtEnd(node, path = [], text) {
  return findSelectionIn(node, path.slice(), node.size, -1, text)
}

// : (ProseMirror, Pos, number)
// Whether vertical position motion in a given direction
// from a position would leave a text block.
export function verticalMotionLeavesTextblock(pm, pos, dir) {
  let dom = pathToDOM(pm.content, pos.path)
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
