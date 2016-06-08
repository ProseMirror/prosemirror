const {contains} = require("../util/dom")

function isEditorContent(dom) {
  return dom.classList.contains("ProseMirror-content")
}

// : (DOMNode) → number
// Get the position before a given a DOM node in a document.
function posBeforeFromDOM(node) {
  let pos = 0, add = 0
  for (let cur = node; !isEditorContent(cur); cur = cur.parentNode) {
    let attr = cur.getAttribute("pm-offset")
    if (attr) { pos += +attr + add; add = 1 }
  }
  return pos
}
exports.posBeforeFromDOM = posBeforeFromDOM

// : (DOMNode, DOMNode, number) → number
function posFromDOM(dom, domOffset) {
  if (domOffset == null) {
    domOffset = Array.prototype.indexOf.call(dom.parentNode.childNodes, dom)
    dom = dom.parentNode
  }

  // Move up to the wrapping container, counting local offset along
  // the way.
  let innerOffset = 0, tag
  for (;;) {
    let adjust = 0
    if (dom.nodeType == 3) {
      innerOffset += domOffset
    } else if (tag = dom.getAttribute("pm-offset") && !childContainer(dom)) {
      let size = +dom.getAttribute("pm-size")
      if (domOffset == dom.childNodes.length) innerOffset = size
      else innerOffset = Math.min(innerOffset, size)
      return posBeforeFromDOM(dom) + innerOffset
    } else if (dom.hasAttribute("pm-container")) {
      break
    } else if (tag = dom.getAttribute("pm-inner-offset")) {
      innerOffset += +tag
      adjust = -1
    } else if (domOffset && domOffset == dom.childNodes.length) {
      adjust = 1
    }

    let parent = dom.parentNode
    domOffset = adjust < 0 ? 0 : Array.prototype.indexOf.call(parent.childNodes, dom) + adjust
    dom = parent
  }

  let start = isEditorContent(dom) ? 0 : posBeforeFromDOM(dom) + 1, before = 0

  for (let child = dom.childNodes[domOffset - 1]; child; child = child.previousSibling) {
    if (child.nodeType == 1 && (tag = child.getAttribute("pm-offset"))) {
      before += +tag + +child.getAttribute("pm-size")
      break
    }
  }
  return start + before + innerOffset
}
exports.posFromDOM = posFromDOM

// : (DOMNode) → ?DOMNode
function childContainer(dom) {
  return dom.hasAttribute("pm-container") ? dom : dom.querySelector("[pm-container]")
}
exports.childContainer = childContainer

// : (ProseMirror, number) → {node: DOMNode, offset: number}
// Find the DOM node and offset into that node that the given document
// position refers to.
function DOMFromPos(pm, pos, loose) {
  if (!loose && pm.operation && pm.doc != pm.operation.doc)
    throw new RangeError("Resolving a position in an outdated DOM structure")

  let container = pm.content, offset = pos
  for (;;) {
    for (let child = container.firstChild, i = 0;; child = child.nextSibling, i++) {
      if (!child) {
        if (offset && !loose) throw new RangeError("Failed to find node at " + pos)
        return {node: container, offset: i}
      }

      let size = child.nodeType == 1 && child.getAttribute("pm-size")
      if (size) {
        if (!offset) return {node: container, offset: i}
        size = +size
        if (offset < size) {
          container = childContainer(child)
          if (!container) {
            return leafAt(child, offset)
          } else {
            offset--
            break
          }
        } else {
          offset -= size
        }
      }
    }
  }
}
exports.DOMFromPos = DOMFromPos

// : (ProseMirror, number) → {node: DOMNode, offset: number}
// The same as DOMFromPos, but searching from the bottom instead of
// the top. This is needed in domchange.js, when there is an arbitrary
// DOM change somewhere in our document, and we can no longer rely on
// the DOM structure around the selection.
function DOMFromPosFromEnd(pm, pos) {
  let container = pm.content, dist = (pm.operation ? pm.operation.doc : pm.doc).content.size - pos
  for (;;) {
    for (let child = container.lastChild, i = container.childNodes.length;; child = child.previousSibling, i--) {
      if (!child) return {node: container, offset: i}

      let size = child.nodeType == 1 && child.getAttribute("pm-size")
      if (size) {
        if (!dist) return {node: container, offset: i}
        size = +size
        if (dist < size) {
          container = childContainer(child)
          if (!container) {
            return leafAt(child, size - dist)
          } else {
            dist--
            break
          }
        } else {
          dist -= size
        }
      }
    }
  }
}
exports.DOMFromPosFromEnd = DOMFromPosFromEnd

// : (ProseMirror, number) → DOMNode
function DOMAfterPos(pm, pos) {
  let {node, offset} = DOMFromPos(pm, pos)
  if (node.nodeType != 1 || offset == node.childNodes.length)
    throw new RangeError("No node after pos " + pos)
  return node.childNodes[offset]
}
exports.DOMAfterPos = DOMAfterPos

// : (DOMNode, number) → {node: DOMNode, offset: number}
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

function windowRect() {
  return {left: 0, right: window.innerWidth,
          top: 0, bottom: window.innerHeight}
}

function scrollIntoView(pm, pos) {
  if (!pos) pos = pm.sel.range.head || pm.sel.range.from
  let coords = coordsAtPos(pm, pos)
  for (let parent = pm.content;; parent = parent.parentNode) {
    let {scrollThreshold, scrollMargin} = pm.options
    let atBody = parent == document.body
    let rect = atBody ? windowRect() : parent.getBoundingClientRect()
    let moveX = 0, moveY = 0
    if (coords.top < rect.top + scrollThreshold)
      moveY = -(rect.top - coords.top + scrollMargin)
    else if (coords.bottom > rect.bottom - scrollThreshold)
      moveY = coords.bottom - rect.bottom + scrollMargin
    if (coords.left < rect.left + scrollThreshold)
      moveX = -(rect.left - coords.left + scrollMargin)
    else if (coords.right > rect.right - scrollThreshold)
      moveX = coords.right - rect.right + scrollMargin
    if (moveX || moveY) {
      if (atBody) {
        window.scrollBy(moveX, moveY)
      } else {
        if (moveY) parent.scrollTop += moveY
        if (moveX) parent.scrollLeft += moveX
      }
    }
    if (atBody) break
  }
}
exports.scrollIntoView = scrollIntoView

function findOffsetInNode(node, coords) {
  let closest, dyClosest = 2e8, coordsClosest, offset = 0
  for (let child = node.firstChild; child; child = child.nextSibling) {
    let rects
    if (child.nodeType == 1) rects = child.getClientRects()
    else if (child.nodeType == 3) rects = textRange(child).getClientRects()
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
    if (rect.left - 1 <= coords.left && rect.right + 1 >= coords.left &&
        rect.top - 1 <= coords.top && rect.bottom + 1 >= coords.top)
      return {node, offset: i + (coords.left >= (rect.left + rect.right) / 2 ? 1 : 0)}
  }
  return {node, offset: 0}
}

// Given an x,y position on the editor, get the position in the document.
function posAtCoords(pm, coords) {
  let elt = document.elementFromPoint(coords.left, coords.top + 1)
  if (!contains(pm.content, elt)) return null

  if (!elt.firstChild) elt = elt.parentNode
  let {node, offset} = findOffsetInNode(elt, coords)
  return posFromDOM(node, offset)
}
exports.posAtCoords = posAtCoords

function textRange(node, from, to) {
  let range = document.createRange()
  range.setEnd(node, to == null ? node.nodeValue.length : to)
  range.setStart(node, from || 0)
  return range
}

function singleRect(object, bias) {
  let rects = object.getClientRects()
  return !rects.length ? object.getBoundingClientRect() : rects[bias < 0 ? 0 : rects.length - 1]
}

// : (ProseMirror, number) → ClientRect
// Given a position in the document model, get a bounding box of the
// character at that position, relative to the window.
function coordsAtPos(pm, pos) {
  let {node, offset} = DOMFromPos(pm, pos)
  let side, rect
  if (node.nodeType == 3) {
    if (offset < node.nodeValue.length) {
      rect = singleRect(textRange(node, offset, offset + 1), -1)
      side = "left"
    }
    if ((!rect || rect.left == rect.right) && offset) {
      rect = singleRect(textRange(node, offset - 1, offset), 1)
      side = "right"
    }
  } else if (node.firstChild) {
    if (offset < node.childNodes.length) {
      let child = node.childNodes[offset]
      rect = singleRect(child.nodeType == 3 ? textRange(child) : child, -1)
      side = "left"
    }
    if ((!rect || rect.top == rect.bottom) && offset) {
      let child = node.childNodes[offset - 1]
      rect = singleRect(child.nodeType == 3 ? textRange(child) : child, 1)
      side = "right"
    }
  } else {
    rect = node.getBoundingClientRect()
    side = "left"
  }
  let x = rect[side]
  return {top: rect.top, bottom: rect.bottom, left: x, right: x}
}
exports.coordsAtPos = coordsAtPos

// ;; #path=NodeType #kind=class #noAnchor
// You can add several properties to [node types](#NodeType) to
// influence the way the editor interacts with them.

function targetKludge(dom, coords) {
  if (/^[uo]l$/i.test(dom.nodeName)) {
    for (let child = dom.firstChild; child; child = child.nextSibling) {
      if (child.nodeType != 1 || !child.hasAttribute("pm-offset") || !/^li$/i.test(child.nodeName)) continue
      let childBox = child.getBoundingClientRect()
      if (coords.left > childBox.left - 2) break
      if (childBox.top <= coords.top && childBox.bottom >= coords.top) return child
    }
  }
  return dom
}

function selectableNodeAbove(pm, dom, coords, liberal) {
  dom = targetKludge(dom, coords)
  for (; dom && dom != pm.content; dom = dom.parentNode) {
    if (dom.hasAttribute("pm-offset")) {
      let pos = posBeforeFromDOM(dom), node = pm.doc.nodeAt(pos)
      // Leaf nodes are implicitly clickable
      if ((liberal || node.type.isLeaf) && node.type.selectable) return pos
      if (!liberal) return null
    }
  }
}
exports.selectableNodeAbove = selectableNodeAbove

// :: (pm: ProseMirror, event: MouseEvent, pos: number, node: Node) → bool
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

// :: (pm: ProseMirror, event: MouseEvent, pos: number, node: Node) → bool
// #path=NodeType.prototype.handleDoubleClick
// This works like [`handleClick`](#NodeType.handleClick), but is
// called for double clicks instead.

// :: (pm: ProseMirror, event: MouseEvent, pos: number, node: Node) → bool
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

function handleNodeClick(pm, type, event, target, direct) {
  for (let dom = target; dom && dom != pm.content; dom = dom.parentNode) {
    if (dom.hasAttribute("pm-offset")) {
      let pos = posBeforeFromDOM(dom), node = pm.doc.nodeAt(pos)
      let handled = node.type[type] && node.type[type](pm, event, pos, node) !== false
      if (direct || handled) return handled
    }
  }
}
exports.handleNodeClick = handleNodeClick
