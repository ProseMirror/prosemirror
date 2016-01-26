import {Pos} from "../model"
import {ProseMirrorError, AssertionError} from "../util/error"

import {contains, browser} from "../dom"

// ;; Error type used to signal selection-related problems.
export class SelectionError extends ProseMirrorError {}

export class SelectionState {
  constructor(pm) {
    this.pm = pm

    this.range = findSelectionAtStart(pm.doc)
    this.lastNonNodePos = null

    this.pollState = null
    this.pollTimeout = null
    this.lastAnchorNode = this.lastHeadNode = this.lastAnchorOffset = this.lastHeadOffset = null
    this.lastNode = null

    pm.content.addEventListener("focus", () => this.receivedFocus())
  }

  setAndSignal(range, clearLast) {
    this.set(range, clearLast)
    // :: () #path=ProseMirror#events#selectionChange
    // Indicates that the editor's selection has changed.
    this.pm.signal("selectionChange")
  }

  set(range, clearLast) {
    this.range = range
    if (!range.node) this.lastNonNodePos = null
    if (clearLast !== false) this.lastAnchorNode = null
  }

  pollForUpdate() {
    if (this.pm.input.composing) return
    clearTimeout(this.pollTimeout)
    this.pollState = "update"
    let n = 0, check = () => {
      if (this.pm.input.composing) {
        // Abort
      } else if (this.pm.operation) {
        this.pollTimeout = setTimeout(check, 20)
      } else if (!this.readUpdate() && ++n == 1) {
        this.pollTimeout = setTimeout(check, 50)
      } else {
        this.stopPollingForUpdate()
      }
    }
    this.pollTimeout = setTimeout(check, 20)
  }

  stopPollingForUpdate() {
    if (this.pollState == "update") {
      this.pollState = null
      this.pollToSync()
    }
  }

  domChanged() {
    let sel = getSelection()
    return sel.anchorNode != this.lastAnchorNode || sel.anchorOffset != this.lastAnchorOffset ||
      sel.focusNode != this.lastHeadNode || sel.focusOffset != this.lastHeadOffset
  }

  storeDOMState() {
    let sel = getSelection()
    this.lastAnchorNode = sel.anchorNode; this.lastAnchorOffset = sel.anchorOffset
    this.lastHeadNode = sel.focusNode; this.lastHeadOffset = sel.focusOffset
  }

  readUpdate() {
    if (this.pm.input.composing || !hasFocus(this.pm) || !this.domChanged()) return false

    let sel = getSelection(), doc = this.pm.doc
    let anchor = posFromDOMInner(this.pm, sel.anchorNode, sel.anchorOffset)
    let head = posFromDOMInner(this.pm, sel.focusNode, sel.focusOffset)
    let newSel = findSelectionNear(doc, head, this.range.head && this.range.head.cmp(head) < 0 ? -1 : 1)
    if (newSel instanceof TextSelection && doc.path(anchor.path).isTextblock)
      newSel = new TextSelection(anchor, newSel.head)
    this.setAndSignal(newSel)
    if (newSel instanceof NodeSelection || newSel.head.cmp(head) || newSel.anchor.cmp(anchor)) {
      this.toDOM()
    } else {
      this.clearNode()
      this.storeDOMState()
    }
    return true
  }

  pollToSync() {
    if (this.pollState) return
    this.pollState = "sync"
    let sync = () => {
      if (document.activeElement != this.pm.content) {
        this.pollState = null
      } else {
        if (!this.pm.operation && !this.pm.input.composing) this.syncDOM()
        this.pollTimeout = setTimeout(sync, 200)
      }
    }
    this.pollTimeout = setTimeout(sync, 200)
  }

  syncDOM() {
    if (!this.pm.input.composing && hasFocus(this.pm) && this.domChanged())
      this.toDOM()
  }

  toDOM(takeFocus) {
    if (this.range instanceof NodeSelection)
      this.nodeToDOM(takeFocus)
    else
      this.rangeToDOM(takeFocus)
  }

  nodeToDOM(takeFocus) {
    window.getSelection().removeAllRanges()
    if (takeFocus) this.pm.content.focus()
    let pos = this.range.from, node = this.range.node
    let dom = resolvePath(this.pm.content, pos.toPath())
    if (dom == this.lastNode) return
    this.clearNode()
    addNodeSelection(node, dom)
    this.lastNode = dom
  }

  clearNode() {
    if (this.lastNode) {
      clearNodeSelection(this.lastNode)
      this.lastNode = null
      return true
    }
  }

  rangeToDOM(takeFocus) {
    let sel = window.getSelection()
    if (!this.clearNode() && !hasFocus(this.pm)) {
      if (!takeFocus) return
      // See https://bugzilla.mozilla.org/show_bug.cgi?id=921444
      else if (browser.gecko) this.pm.content.focus()
    }
    if (!this.domChanged()) return

    let range = document.createRange()
    let content = this.pm.content
    let anchor = DOMFromPos(content, this.range.anchor)
    let head = DOMFromPos(content, this.range.head)

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

  receivedFocus() {
    if (!this.pollState) this.pollToSync()
  }

  beforeStartOp() {
    if (this.pollState == "update" && this.readUpdate()) {
      clearTimeout(this.pollTimeout)
      this.stopPollingForUpdate()
    } else {
      this.syncDOM()
    }
  }
}

function clearNodeSelection(dom) {
  dom.classList.remove("ProseMirror-selectednode")
}

function addNodeSelection(_node, dom) {
  dom.classList.add("ProseMirror-selectednode")
}

function windowRect() {
  return {left: 0, right: window.innerWidth,
          top: 0, bottom: window.innerHeight}
}

// ;; An editor selection. Can be one of two selection types:
// `TextSelection` and `NodeSelection`. Both have the properties
// listed here, but also contain more information (such as the
// selected [node](#NodeSelection.node) or the
// [head](#TextSelection.head) and [anchor](#TextSelection.anchor)).
export class Selection {
  // :: Pos #path=Selection.prototype.from
  // The start of the selection.

  // :: Pos #path=Selection.prototype.to
  // The end of the selection.

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

function pathFromDOM(pm, node) {
  let path = []
  for (; node != pm.content;) {
    let attr = node.getAttribute("pm-offset")
    if (attr) path.unshift(+attr)
    node = node.parentNode
  }
  return path
}

function widthFromDOM(dom) {
  let attr = dom.getAttribute("pm-leaf")
  return attr && attr != "true" ? +attr : 1
}

function posFromDOMInner(pm, dom, domOffset, loose) {
  if (!loose && pm.operation && pm.doc != pm.operation.doc)
    AssertionError.raise("Fetching a position from an outdated DOM structure")

  let extraOffset = 0, tag
  for (;;) {
    let adjust = 0
    if (dom.nodeType == 3) {
      extraOffset += domOffset
    } else if (dom.hasAttribute("pm-offset") || dom == pm.content) {
      break
    } else if (tag = dom.getAttribute("pm-inner-offset")) {
      extraOffset += +tag
      adjust = -1
    } else if (domOffset && domOffset == dom.childNodes.length) {
      adjust = 1
    }

    let parent = dom.parentNode
    domOffset = adjust < 0 ? 0 : Array.prototype.indexOf.call(parent.childNodes, dom) + adjust
    dom = parent
  }

  let path = pathFromDOM(pm, dom)
  if (dom.hasAttribute("pm-leaf"))
    return Pos.from(path, extraOffset + (domOffset ? 1 : 0))

  let offset = 0
  for (let i = domOffset - 1; i >= 0; i--) {
    let child = dom.childNodes[i]
    if (child.nodeType == 3) {
      if (loose) extraOffset += child.nodeValue.length
    } else if (tag = child.getAttribute("pm-offset")) {
      offset = +tag + widthFromDOM(child)
      break
    } else if (loose && !child.hasAttribute("pm-ignore")) {
      extraOffset += child.textContent.length
    }
  }
  return new Pos(path, offset + extraOffset)
}

export function posFromDOM(pm, node, offset) {
  if (offset == null) {
    offset = Array.prototype.indexOf.call(node.parentNode.childNodes, node)
    node = node.parentNode
  }
  return posFromDOMInner(pm, node, offset)
}

export function rangeFromDOMLoose(pm) {
  if (!hasFocus(pm)) return null
  let sel = getSelection()
  return new TextSelection(posFromDOMInner(pm, sel.anchorNode, sel.anchorOffset, true),
                           posFromDOMInner(pm, sel.focusNode, sel.focusOffset, true))
}

export function findByPath(node, n, fromEnd) {
  for (let ch = fromEnd ? node.lastChild : node.firstChild; ch;
       ch = fromEnd ? ch.previousSibling : ch.nextSibling) {
    if (ch.nodeType != 1) continue
    let offset = ch.getAttribute("pm-offset")
    if (!offset) {
      let found = findByPath(ch, n)
      if (found) return found
    } else if (+offset == n) {
      return ch
    }
  }
}

export function resolvePath(parent, path) {
  let node = parent
  for (let i = 0; i < path.length; i++) {
    node = findByPath(node, path[i])
    if (!node) SelectionError.raise("Failed to resolve path " + path.join("/"))
  }
  return node
}

function findByOffset(node, offset, after) {
  function search(node) {
    for (let ch = node.firstChild, i = 0, attr; ch; ch = ch.nextSibling, i++) {
      if (ch.nodeType != 1) continue
      if (attr = ch.getAttribute("pm-offset")) {
        let diff = offset - +attr, width = widthFromDOM(ch)
        if (diff >= 0 && (after ? diff <= width : diff < width))
          return {node: ch, offset: i, innerOffset: diff}
      } else {
        let result = search(ch)
        if (result) return result
      }
    }
  }
  return search(node)
}

function leafAt(node, offset) {
  for (;;) {
    let child = node.firstChild
    if (!child) return {node, offset}
    if (child.nodeType != 1) return {node: child, offset}
    if (child.hasAttribute("pm-inner-offset")) {
      let nodeOffset = 0
      for (;;) {
        let nextSib = child.nextSibling, nextOffset
        if (!nextSib || (nextOffset = +nextSib.getAttribute("pm-inner-offset")) >= offset) break
        child = nextSib
        nodeOffset = nextOffset
      }
      offset -= nodeOffset
    }
    node = child
  }
}

// Get a DOM element at a given position in the document.
function DOMFromPos(parent, pos) {
  let dom = resolvePath(parent, pos.path)
  let found = findByOffset(dom, pos.offset, true), inner
  if (!found) return {node: dom, offset: 0}
  if (found.node.getAttribute("pm-leaf") == "true" || !(inner = leafAt(found.node, found.innerOffset)))
    return {node: found.node.parentNode, offset: found.offset + (found.innerOffset ? 1 : 0)}
  else
    return inner
}

export function hasFocus(pm) {
  let sel = window.getSelection()
  return sel.rangeCount && contains(pm.content, sel.anchorNode)
}

function findOffsetInNode(node, coords) {
  let closest, dyClosest = 1e8, coordsClosest, offset = 0
  for (let child = node.firstChild, i = 0; child; child = child.nextSibling, i++) {
    let rects
    if (child.nodeType == 1) rects = child.getClientRects()
    else if (child.nodeType == 3) rects = textRects(child)
    else continue

    for (let i = 0; i < rects.length; i++) {
      let rect = rects[i]
      if (rect.left <= coords.left && rect.right >= coords.left) {
        let dy = rect.top > coords.top ? rect.top - coords.top
            : rect.bottom < coords.top ? coords.top - rect.bottom : 0
        if (dy < dyClosest) { // FIXME does not group by row
          closest = child
          dyClosest = dy
          coordsClosest = dy ? {left: coords.left, top: rect.top} : coords
          if (child.nodeType == 1 && !child.firstChild)
            offset = i + (coords.left >= (rect.left + rect.right) / 2 ? 1 : 0)
          continue
        }
      }
      if (!closest &&
          (coords.top >= rect.bottom || coords.top >= rect.top && coords.left >= rect.right))
        offset = i + 1
    }
  }
  if (!closest) return {node, offset}
  if (closest.nodeType == 3) return findOffsetInText(closest, coordsClosest)
  if (closest.firstChild) return findOffsetInNode(closest, coordsClosest)
  return {node, offset}
}

function findOffsetInText(node, coords) {
  let len = node.nodeValue.length
  let range = document.createRange()
  for (let i = 0; i < len; i++) {
    range.setEnd(node, i + 1)
    range.setStart(node, i)
    let rect = range.getBoundingClientRect()
    if (rect.top == rect.bottom) continue
    if (rect.left <= coords.left && rect.right >= coords.left &&
        rect.top <= coords.top && rect.bottom >= coords.top)
      return {node, offset: i + (coords.left >= (rect.left + rect.right) / 2 ? 1 : 0)}
  }
  return {node, offset: 0}
}

// Given an x,y position on the editor, get the position in the document.
export function posAtCoords(pm, coords) {
  let elt = document.elementFromPoint(coords.left, coords.top + 1)
  if (!contains(pm.content, elt)) return null

  if (!elt.firstChild) elt = elt.parentNode
  let {node, offset} = findOffsetInNode(elt, coords)
  return posFromDOM(pm, node, offset)
}

function textRect(node, from, to) {
  let range = document.createRange()
  range.setEnd(node, to)
  range.setStart(node, from)
  return range.getBoundingClientRect()
}

function textRects(node) {
  let range = document.createRange()
  range.setEnd(node, node.nodeValue.length)
  range.setStart(node, 0)
  return range.getClientRects()
}

// Given a position in the document model, get a bounding box of the character at
// that position, relative to the window.
export function coordsAtPos(pm, pos) {
  let {node, offset} = DOMFromPos(pm.content, pos)
  let side, rect
  if (node.nodeType == 3) {
    if (offset < node.nodeValue.length) {
      rect = textRect(node, offset, offset + 1)
      side = "left"
    }
    if ((!rect || rect.left == rect.right) && offset) {
      rect = textRect(node, offset - 1, offset)
      side = "right"
    }
  } else if (node.firstChild) {
    if (offset < node.childNodes.length) {
      let child = node.childNodes[offset]
      rect = child.nodeType == 3 ? textRect(child, 0, child.nodeValue.length) : child.getBoundingClientRect()
      side = "left"
    }
    if ((!rect || rect.left == rect.right) && offset) {
      let child = node.childNodes[offset - 1]
      rect = child.nodeType == 3 ? textRect(child, 0, child.nodeValue.length) : child.getBoundingClientRect()
      side = "right"
    }
  } else {
    rect = node.getBoundingClientRect()
    side = "left"
  }
  let x = rect[side]
  return {top: rect.top, bottom: rect.bottom, left: x, right: x}
}

const scrollMargin = 5

export function scrollIntoView(pm, pos) {
  if (!pos) pos = pm.sel.range.head || pm.sel.range.from
  let coords = coordsAtPos(pm, pos)
  for (let parent = pm.content;; parent = parent.parentNode) {
    let atBody = parent == document.body
    let rect = atBody ? windowRect() : parent.getBoundingClientRect()
    let moveX = 0, moveY = 0
    if (coords.top < rect.top)
      moveY =  -(rect.top - coords.top + scrollMargin)
    else if (coords.bottom > rect.bottom)
      moveY = coords.bottom - rect.bottom + scrollMargin
    if (coords.left < rect.left)
      moveX = -(rect.left - coords.left + scrollMargin)
    else if (coords.right > rect.right)
      moveX = coords.right - rect.right + scrollMargin
    if (moveX || moveY) {
      if (atBody) window.scrollBy(moveX, moveY)
    } else {
      if (moveY) parent.scrollTop += moveY
      if (moveX) parent.scrollLeft += moveX
    }
    if (atBody) break
  }
}
function findSelectionIn(doc, path, offset, dir, text) {
  let node = doc.path(path)
  if (node.isTextblock) return new TextSelection(new Pos(path, offset))

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

export function findSelectionAtStart(node, path = [], text) {
  return findSelectionIn(node, path.slice(), 0, 1, text)
}

export function findSelectionAtEnd(node, path = [], text) {
  return findSelectionIn(node, path.slice(), node.size, -1, text)
}

// ;; #path=NodeType #kind=class #noAnchor
// You can add several properties to [node types](#NodeType) to
// influence the way the editor interacts with them.

// :: (node: Node, path: [number], dom: DOMNode, coords: {left: number, top: number}) → ?Pos
// #path=NodeType.prototype.countCoordsAsChild
// Specifies that, if this node is clicked, a child node might
// actually be meant. This is used to, for example, make clicking a
// list marker (which, in the DOM, is part of the list node) select
// the list item it belongs to. Should return null if the given
// coordinates don't refer to a child node, or the [position](#Pos)
// before the child otherwise.

export function selectableNodeAbove(pm, dom, coords, liberal) {
  for (; dom && dom != pm.content; dom = dom.parentNode) {
    if (dom.hasAttribute("pm-offset")) {
      let path = pathFromDOM(pm, dom), node = pm.doc.path(path)
      if (node.type.countCoordsAsChild) {
        let result = node.type.countCoordsAsChild(node, path, dom, coords)
        if (result) return result
      }
      // Leaf nodes are implicitly clickable
      if ((liberal || node.type.contains == null) && node.type.selectable)
        return Pos.from(path)
      if (!liberal) return null
    }
  }
}

// :: (pm: ProseMirror, event: MouseEvent, path: [number], node: Node) → bool
// #path=NodeType.prototype.handleClick
// If a node is directly clicked (that is, the click didn't land in a
// DOM node belonging to a child node), and its type has a
// `handleClick` method, that method is given a chance to handle the
// click. The method is called, and should return `false` if it did
// _not_ handle the click.
//
// The `event` passed is the event for `"mousedown"`, but calling
// `preventDefault` on it has no effect, since this method is only
// called after a corresponding `"mouseup"` has occurred and
// ProseMirror has determined that this is not a drag or multi-click
// event.

// :: (pm: ProseMirror, event: MouseEvent, path: [number], node: Node) → bool
// #path=NodeType.prototype.handleContextMenu
//
// When the [context
// menu](https://developer.mozilla.org/en-US/docs/Web/Events/contextmenu)
// is activated in the editable context, nodes that the clicked
// position falls inside of get a chance to react to it. Node types
// may define a `handleContextMenu` method, which will be called when
// present, first on inner nodes and then up the document tree, until
// one of the methods returns something other than `false`.
//
// The handlers can inspect `event.target` to figure out whether they
// were directly clicked, and may call `event.preventDefault()` to
// prevent the native context menu.

export function handleNodeClick(pm, type, event, direct) {
  for (let dom = event.target; dom && dom != pm.content; dom = dom.parentNode) {
    if (dom.hasAttribute("pm-offset")) {
      let path = pathFromDOM(pm, dom), node = pm.doc.path(path)
      let handled = node.type[type] && node.type[type](pm, event, path, node) !== false
      if (direct || handled) return handled
    }
  }
}

export function verticalMotionLeavesTextblock(pm, pos, dir) {
  let dom = resolvePath(pm.content, pos.path)
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

export function setDOMSelectionToPos(pm, pos) {
  let {node, offset} = DOMFromPos(pm.content, pos)
  let range = document.createRange()
  range.setEnd(node, offset)
  range.setStart(node, offset)
  let sel = getSelection()
  sel.removeAllRanges()
  sel.addRange(range)
}
