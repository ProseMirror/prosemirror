import {contains} from "../dom"

// : (ProseMirror, DOMNode) → number
// Get the path for a given a DOM node in a document.
export function posBeforeFromDOM(pm, node) {
  let pos = 0, add = 0
  for (let cur = node; cur != pm.content; cur = cur.parentNode) {
    let attr = cur.getAttribute("pm-offset")
    if (attr) { pos += +attr + add; add = 1 }
  }
  return pos
}

// : (ProseMirror, DOMNode, number) → number
export function posFromDOM(pm, dom, domOffset, loose) {
  if (!loose && pm.operation && pm.doc != pm.operation.doc)
    throw new RangeError("Fetching a position from an outdated DOM structure")

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
      if (!loose) {
        let size = +dom.getAttribute("pm-size")
        if (domOffset == dom.childNodes.length) innerOffset = size
        else innerOffset = Math.min(innerOffset, size)
      }
      return posBeforeFromDOM(pm, dom) + innerOffset
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

  let start = dom == pm.content ? 0 : posBeforeFromDOM(pm, dom) + 1, before = 0

  for (let child = dom.childNodes[domOffset - 1]; child; child = child.previousSibling) {
    if (child.nodeType == 1 && (tag = child.getAttribute("pm-offset"))) {
      before += +tag + +child.getAttribute("pm-size")
      break
    } else if (loose && child.nodeType == 3) {
      before += child.nodeValue.length
    }
  }
  return start + before + innerOffset
}

// : (DOMNode) → ?DOMNode
export function childContainer(dom) {
  return dom.hasAttribute("pm-container") ? dom : dom.querySelector("[pm-container]")
}

// : (ProseMirror, number) → {node: DOMNode, offset: number}
// Find the DOM node and offset into that node that the given document
// position refers to.
export function DOMFromPos(pm, pos, loose, exactEndPos) {
  if (!loose && pm.operation && pm.doc != pm.operation.doc)
    throw new RangeError("Resolving a position in an outdated DOM structure")

  let container = pm.content, offset = pos
  for (;;) {
    for (let child = container.firstChild, i = 0;; child = child.nextSibling, i++) {
      if (!child) {
        if (offset && !loose) throw new RangeError("Failed to find node at " + pos + " rem = " + offset)
        return {node: container, offset: i}
      }

      let size = child.nodeType == 1 && child.getAttribute("pm-size")
      if (size) {
        if (!offset) return {node: container, offset: i}
        size = +size
        if (offset < size || (exactEndPos && offset === size)) {
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

// : (ProseMirror, number) → DOMNode
export function DOMAfterPos(pm, pos) {
  let {node, offset} = DOMFromPos(pm, pos)
  if (node.nodeType != 1 || offset == node.childNodes.length)
    throw new RangeError("No node after pos " + pos)
  return node.childNodes[offset]
}

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

export function scrollIntoView(pm, pos) {
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

function findOffsetInNode(node, coords) {
  let closest, dyClosest = 2e8, coordsClosest, offset = 0
  for (let child = node.firstChild; child; child = child.nextSibling) {
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
    if (rect.left - 1 <= coords.left && rect.right + 1 >= coords.left &&
        rect.top - 1 <= coords.top && rect.bottom + 1 >= coords.top)
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
  let rects = range.getClientRects()
  // Return the last rect
  return rects[rects.length-1]
}

function textRects(node) {
  let range = document.createRange()
  range.setEnd(node, node.nodeValue.length)
  range.setStart(node, 0)
  return range.getClientRects()
}

// : (ProseMirror, number) → ClientRect
// Given a position in the document model, get a bounding box of the character at
// that position, relative to the window.
export function coordsAtPos(pm, pos) {
  let {node, offset} = DOMFromPos(pm, pos, false, true)
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
    if ((!rect || rect.top == rect.bottom) && offset) {
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

// ;; #path=NodeType #kind=class #noAnchor
// You can add several properties to [node types](#NodeType) to
// influence the way the editor interacts with them.

// :: (node: Node, pos: number, dom: DOMNode, coords: {left: number, top: number}) → ?number
// #path=NodeType.prototype.countCoordsAsChild
// Specifies that, if this node is clicked, a child node might
// actually be meant. This is used to, for example, make clicking a
// list marker (which, in the DOM, is part of the list node) select
// the list item it belongs to. Should return null if the given
// coordinates don't refer to a child node, or the position
// before the child otherwise.

export function selectableNodeAbove(pm, dom, coords, liberal) {
  for (; dom && dom != pm.content; dom = dom.parentNode) {
    if (dom.hasAttribute("pm-offset")) {
      let pos = posBeforeFromDOM(pm, dom), node = pm.doc.nodeAt(pos)
      if (node.type.countCoordsAsChild) {
        let result = node.type.countCoordsAsChild(node, pos, dom, coords)
        if (result != null) return result
      }
      // Leaf nodes are implicitly clickable
      if ((liberal || node.type.isLeaf) && node.type.selectable)
        return pos
      if (!liberal) return null
    }
  }
}

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

export function handleNodeClick(pm, type, event, target, direct) {
  for (let dom = target; dom && dom != pm.content; dom = dom.parentNode) {
    if (dom.hasAttribute("pm-offset")) {
      let pos = posBeforeFromDOM(pm, dom), node = pm.doc.nodeAt(pos)
      let handled = node.type[type] && node.type[type](pm, event, pos, node) !== false
      if (direct || handled) return handled
    }
  }
}
