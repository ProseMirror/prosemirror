import {Pos} from "../model"

import {contains, browser} from "../dom"

export class Selection {
  constructor(pm) {
    this.pm = pm

    let start = Pos.start(pm.doc)
    this.range = new SelectionRange(pm.doc, start, start)
    this.lastNonNodePos = null

    this.pollState = null
    this.pollTimeout = null
    this.lastAnchorNode = this.lastHeadNode = this.lastAnchorOffset = this.lastHeadOffset = null
    this.lastNode = null

    pm.content.addEventListener("focus", () => this.receivedFocus())
  }

  setAndSignal(range, clearLast) {
    this.set(range, clearLast)
    this.pm.signal("selectionChange")
  }

  set(range, clearLast) {
    this.range = range
    if (!range.nodePos) this.lastNonNodePos = null
    if (clearLast !== false) this.lastAnchorNode = null
  }

  setNode(pos) {
    let parent = this.pm.doc.path(pos.path)
    let rangeFrom = pos, rangeTo = pos.move(1)
    if (!parent.isTextblock) {
      rangeFrom = Pos.after(this.pm.doc, rangeFrom)
      rangeTo = Pos.before(this.pm.doc, rangeTo) || rangeFrom
      if (!rangeFrom) rangeFrom = rangeTo
      if (rangeFrom.cmp(rangeTo) > 0) rangeTo = rangeFrom
    }
    this.set(new SelectionRange(this.pm.doc, rangeFrom, rangeTo, pos))
  }

  setNodeAndSignal(pos) {
    this.setNode(pos)
    this.pm.signal("selectionChange")
  }

  map(mapping) {
    let node = this.range.nodePos
    if (node) {
      let newFrom = mapping.map(node, 1).pos
      let newTo = mapping.map(node.move(1), -1).pos
      if (newTo.cmp(newFrom.move(1)) == 0)
        node = newFrom
      else
        node = null
    }
    return new SelectionRange(this.pm.doc,
                              Pos.near(this.pm.doc, mapping.map(this.range.anchor).pos, 1),
                              Pos.near(this.pm.doc, mapping.map(this.range.head).pos, 1),
                              node)
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
      } else if (this.readUpdate()) {
        this.pollState = null
        this.pollToSync()
      } else if (++n == 1) {
        this.pollTimeout = setTimeout(check, 50)
      }
    }
    this.pollTimeout = setTimeout(check, 20)
  }

  domChanged() {
    let sel = getSelection()
    return sel.anchorNode != this.lastAnchorNode || sel.anchorOffset != this.lastAnchorOffset ||
      sel.focusNode != this.lastHeadNode || sel.focusOffset != this.lastHeadOffset
  }

  readUpdate() {
    if (this.pm.input.composing || !hasFocus(this.pm) || !this.domChanged()) return false

    let sel = getSelection(), doc = this.pm.doc
    let anchor = posFromDOMInner(this.pm, sel.anchorNode, sel.anchorOffset)
    let head = posFromDOMInner(this.pm, sel.focusNode, sel.focusOffset)
    this.lastAnchorNode = sel.anchorNode; this.lastAnchorOffset = sel.anchorOffset
    this.lastHeadNode = sel.focusNode; this.lastHeadOffset = sel.focusOffset
    this.setAndSignal(new SelectionRange(doc, Pos.near(doc, anchor, anchor.cmp(this.range.anchor)),
                                         Pos.near(doc, head, head.cmp(this.range.head))))
    this.toDOM()
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
    if (this.range.nodePos)
      this.nodeToDOM(takeFocus)
    else
      this.rangeToDOM(takeFocus)
  }

  nodeToDOM(takeFocus) {
    window.getSelection().removeAllRanges()
    if (takeFocus) this.pm.content.focus()
    let pos = this.range.nodePos, node = this.range.node, dom
    if (node.isInline)
      dom = findByOffset(resolvePath(this.pm.content, pos.path), pos.offset, true).node
    else
      dom = resolvePath(this.pm.content, pos.path.concat(pos.offset))
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

    this.lastAnchorNode = anchor.node; this.lastAnchorOffset = anchor.offset
    this.lastHeadNode = head.node; this.lastHeadOffset = head.offset
  }

  receivedFocus() {
    if (!this.pollState) this.pollToSync()
  }

  beforeStartOp() {
    if (this.pollState == "update" && this.readUpdate()) {
      clearTimeout(this.pollTimeout)
      this.pollState = null
      this.pollToSync()
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

/**
 * Selection range class.
 *
 * A range consists of a head (the active location of the cursor)
 * and an anchor (the start location of the selection).
 */
export class SelectionRange {
  constructor(doc, anchor, head, nodePos) {
    this.doc = doc
    this.anchor = anchor
    this.head = head
    this.nodePos = nodePos
  }

  get inverted() { return this.anchor.cmp(this.head) > 0 }
  get from() { return this.inverted ? this.head : this.anchor }
  get to() { return this.inverted ? this.anchor : this.head }
  get empty() { return this.anchor.cmp(this.head) == 0 }
  cmp(other) {
    if (this.nodePos) {
      if (!other.nodePos) return 1
      return this.nodePos.cmp(other.nodePos)
    } else if (other.nodePos) {
      return -1
    } else {
      return this.anchor.cmp(other.anchor) || this.head.cmp(other.head)
    }
  }

  get node() {
    if (!this.nodePos) return null
    let parent = this.doc.path(this.nodePos.path)
    if (parent.isTextblock)
      return parent.childAfter(this.nodePos.offset).node
    else
      return parent.child(this.nodePos.offset)
  }
  get cursor() {
    return !this.nodePos && this.empty
  }
}

function pathFromNode(node) {
  let path = []
  for (;;) {
    let attr = node.getAttribute("pm-path")
    if (!attr) return path
    path.unshift(+attr)
    node = node.parentNode
  }
}

function posFromDOMInner(pm, node, domOffset, loose) {
  if (!loose && pm.operation && pm.doc != pm.operation.doc)
    throw new Error("Fetching a position from an outdated DOM structure")

  let extraOffset = 0, tag
  for (;;) {
    if (node.nodeType == 3)
      extraOffset += domOffset
    else if (node.hasAttribute("pm-path") || node == pm.content)
      break
    else if (tag = node.getAttribute("pm-span-offset"))
      extraOffset += +tag

    let parent = node.parentNode
    domOffset = Array.prototype.indexOf.call(parent.childNodes, node) +
      (node.nodeType != 3 && domOffset == node.childNodes.length ? 1 : 0)
    node = parent
  }

  let offset = 0
  for (let i = domOffset - 1; i >= 0; i--) {
    let child = node.childNodes[i]
    if (child.nodeType == 3) {
      if (loose) extraOffset += child.nodeValue.length
    } else if (tag = child.getAttribute("pm-span")) {
      offset = parseSpan(tag).to
      break
    } else if (tag = child.getAttribute("pm-path")) {
      offset = +tag + 1
      extraOffset = 0
      break
    } else if (loose) {
      extraOffset += child.textContent.length
    }
  }
  return new Pos(pathFromNode(node), offset + extraOffset)
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
  return new SelectionRange(pm.doc,
                            posFromDOMInner(pm, sel.anchorNode, sel.anchorOffset, true),
                            posFromDOMInner(pm, sel.focusNode, sel.focusOffset, true))
}

export function findByPath(node, n, fromEnd) {
  for (let ch = fromEnd ? node.lastChild : node.firstChild; ch;
       ch = fromEnd ? ch.previousSibling : ch.nextSibling) {
    if (ch.nodeType != 1) continue
    let path = ch.getAttribute("pm-path")
    if (!path) {
      let found = findByPath(ch, n)
      if (found) return found
    } else if (+path == n) {
      return ch
    }
  }
}

export function resolvePath(parent, path) {
  let node = parent
  for (let i = 0; i < path.length; i++) {
    node = findByPath(node, path[i])
    if (!node) throw new Error("Failed to resolve path " + path.join("/"))
  }
  return node
}

function parseSpan(span) {
  let [_, from, to] = /^(\d+)-(\d+)$/.exec(span)
  return {from: +from, to: +to}
}

function findByOffset(node, offset, after) {
  function search(node, domOffset) {
    if (node.nodeType != 1) return
    let range = node.getAttribute("pm-span")
    if (range) {
      let {from, to} = parseSpan(range)
      if (after ? +from == offset : +to >= offset)
        return {node: node, parent: node.parentNode, offset: domOffset,
                innerOffset: offset - +from}
    } else {
      for (let ch = node.firstChild, i = 0; ch; ch = ch.nextSibling, i++) {
        let result = search(ch, i)
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
    if (child.hasAttribute("pm-span-offset")) {
      let nodeOffset = 0
      for (;;) {
        let nextSib = child.nextSibling, nextOffset
        if (!nextSib || (nextOffset = +nextSib.getAttribute("pm-span-offset")) >= offset) break
        child = nextSib
        nodeOffset = nextOffset
      }
      offset -= nodeOffset
    }
    node = child
  }
}

/**
 * Get a DOM element at a given position in the document.
 *
 * @param {Node} parent The parent DOM node.
 * @param {Pos} pos     The position in the document.
 * @return {Object}     The DOM node and character offset inside the node.
 */
function DOMFromPos(parent, pos) {
  let node = resolvePath(parent, pos.path)
  let found = findByOffset(node, pos.offset), inner
  if (!found) return {node: node, offset: 0}
  if (found.node.hasAttribute("pm-span-atom") || !(inner = leafAt(found.node, found.innerOffset)))
    return {node: found.parent, offset: found.offset + (found.innerOffset ? 1 : 0)}
  else
    return inner
}

export function hasFocus(pm) {
  let sel = window.getSelection()
  return sel.rangeCount && contains(pm.content, sel.anchorNode)
}

/**
 * Given an x,y position on the editor, get the position in the document.
 *
 * @param  {ProseMirror} pm     Editor instance.
 * @param  {Object}      coords The x, y coordinates.
 * @return {Pos}
 */
// FIXME fails on the space between lines
export function posAtCoords(pm, coords) {
  let element = document.elementFromPoint(coords.left, coords.top + 1)
  if (!contains(pm.content, element)) return Pos.start(pm.doc)

  let offset
  if (element.childNodes.length == 1 && element.firstChild.nodeType == 3) {
    element = element.firstChild
    offset = offsetInTextNode(element, coords)
  } else {
    offset = offsetInElement(element, coords)
  }

  return posFromDOM(pm, element, offset)
}

function textRect(node, from, to) {
  let range = document.createRange()
  range.setEnd(node, to)
  range.setStart(node, from)
  return range.getBoundingClientRect()
}

/**
 * Given a position in the document model, get a bounding box of the character at
 * that position, relative to the window.
 *
 * @param  {ProseMirror} pm The editor instance.
 * @param  {Pos}         pos
 * @return {Object} The bounding box.
 */
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
  if (!pos) pos = pm.sel.range.head
  let coords = coordsAtPos(pm, pos)
  for (let parent = pm.content;; parent = parent.parentNode) {
    let atBody = parent == document.body
    let rect = atBody ? windowRect() : parent.getBoundingClientRect()
    if (coords.top < rect.top)
      parent.scrollTop -= rect.top - coords.top + scrollMargin
    else if (coords.bottom > rect.bottom)
      parent.scrollTop += coords.bottom - rect.bottom + scrollMargin
    if (coords.left < rect.left)
      parent.scrollLeft -= rect.left - coords.left + scrollMargin
    else if (coords.right > rect.right)
      parent.scrollLeft += coords.right - rect.right + scrollMargin
    if (atBody) break
  }
}

function offsetInRects(coords, rects, strict) {
  let {top: y, left: x} = coords
  let minY = 1e8, minX = 1e8, offset = 0
  for (let i = 0; i < rects.length; i++) {
    let rect = rects[i]
    if (!rect || rect.top == rect.bottom) continue
    let dX = x < rect.left ? rect.left - x : x > rect.right ? x - rect.right : 0
    if (dX > minX) continue
    if (dX < minX) { minX = dX; minY = 1e8 }
    let dY = y < rect.top ? rect.top - y : y > rect.bottom ? y - rect.bottom : 0
    if (dY < minY) {
      minY = dY
      offset = x < (rect.left + rect.right) / 2 ? i : i + 1
    }
  }
  if (strict && (minX || minY)) return null
  return offset
}

function offsetInTextNode(text, coords, strict) {
  let len = text.nodeValue.length
  let range = document.createRange()
  let rects = []
  for (let i = 0; i < len; i++) {
    range.setEnd(text, i + 1)
    range.setStart(text, i)
    rects.push(range.getBoundingClientRect())
  }
  return offsetInRects(coords, rects, strict)
}

function offsetInElement(element, coords) {
  let rects = []
  for (let child = element.firstChild; child; child = child.nextSibling) {
    if (child.getBoundingClientRect)
      rects.push(child.getBoundingClientRect())
    else
      rects.push(null)
  }
  return offsetInRects(coords, rects)
}

function selectableBlockIn(doc, pos, dir) {
  let node = doc.path(pos.path)
  for (let offset = pos.offset + (dir > 0 ? 0 : -1); dir > 0 ? offset < node.maxOffset : offset >= 0; offset += dir) {
    let child = node.child(offset)
    if (child.isTextblock || (child.type.selectable && child.type.contains == null))
      return pos.path.concat(offset)

    let inside = selectableBlockIn(doc, new Pos(pos.path.concat(offset), dir < 0 ? child.maxOffset : 0), dir)
    if (inside) return inside
  }
}

export function selectableBlockFrom(doc, pos, dir) {
  for (;;) {
    let found = selectableBlockIn(doc, pos, dir)
    if (found) return found
    if (pos.depth == 0) break
    pos = pos.shorten(null, dir > 0 ? 1 : 0)
  }
}

export function selectableNodeUnder(pm, coords) {
  let dom = document.elementFromPoint(coords.left, coords.top)
  for (; dom && dom != pm.content; dom = dom.parentNode) {
    if (dom.hasAttribute("pm-path")) {
      let path = pathFromNode(dom)
      let node = pm.doc.path(path)
      // Leaf nodes are implicitly clickable
      if (node.type.contains == null && node.type.selectable) return Pos.from(path)
      return node.type.clicked ? node.type.clicked(node, path, dom, coords) : null
    } else if (dom.hasAttribute("pm-span-atom")) {
      let path = pathFromNode(dom.parentNode)
      let parent = pm.doc.path(path), span = parseSpan(dom.getAttribute("pm-span"))
      let node = parent.childAfter(span.from).node
      return node.type.selectable ? new Pos(path, span.from) : null
    }
  }
}

export function verticalMotionLeavesTextblock(pm, pos, dir) {
  let dom = resolvePath(pm.content, pos.path)
  let coords = coordsAtPos(pm, pos)
  for (let child = dom.firstChild; child; child = child.nextSibling) {
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
