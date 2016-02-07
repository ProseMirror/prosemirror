import {Pos} from "../model"
import {contains} from "../dom"
import {AssertionError} from "../util/error"

// : (ProseMirror, DOMNode) → [number]
// Get the path for a given a DOM node in a document.
export function pathFromDOM(pm, node) {
  let path = []
  for (; node != pm.content;) {
    let attr = node.getAttribute("pm-offset")
    if (attr) path.unshift(+attr)
    node = node.parentNode
  }
  return path
}

export function widthFromDOM(dom) {
  let attr = dom.getAttribute("pm-leaf")
  return attr && attr != "true" ? +attr : 1
}


export function posFromDOM(pm, dom, domOffset, loose) {
  if (!loose && pm.operation && pm.doc != pm.operation.doc)
    AssertionError.raise("Fetching a position from an outdated DOM structure")

  if (domOffset == null) {
    domOffset = Array.prototype.indexOf.call(dom.parentNode.childNodes, dom)
    dom = dom.parentNode
  }

  let extraOffset = 0, tag
  for (;;) {
    let adjust = 0
    if (dom.nodeType == 3) {
      extraOffset += domOffset
    } else if (dom.hasAttribute("pm-container")) {
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

// : (DOMNode, number, ?bool)
// Get a child node of a parent node at a given offset.
export function findByPath(node, n, fromEnd) {
  let container = childContainer(node)
  for (let ch = fromEnd ? container.lastChild : container.firstChild; ch;
       ch = fromEnd ? ch.previousSibling : ch.nextSibling) {
    if (ch.nodeType != 1) continue
    let offset = ch.getAttribute("pm-offset")
    if (offset && +offset == n) return ch
  }
}

// : (DOMNode, [number]) → DOMNode
// Get a descendant node at a path relative to an ancestor node.
export function pathToDOM(parent, path) {
  let node = parent
  for (let i = 0; i < path.length; i++) {
    node = findByPath(node, path[i])
    if (!node) AssertionError.raise("Failed to resolve path " + path.join("/"))
  }
  return node
}

export function childContainer(dom) {
  return dom.hasAttribute("pm-container") ? dom : dom.querySelector("[pm-container]")
}

function findByOffset(node, offset, after) {
  for (let ch = node.firstChild, i = 0, attr; ch; ch = ch.nextSibling, i++) {
    if (ch.nodeType == 1 && (attr = ch.getAttribute("pm-offset"))) {
      let diff = offset - +attr, width = widthFromDOM(ch)
      if (diff >= 0 && (after ? diff <= width : diff < width))
        return {node: ch, offset: i, innerOffset: diff}
    }
  }
}

// : (node: DOMNode, offset: number) → {node: DOMNode, offset: number}
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
export function DOMFromPos(parent, pos) {
  let dom = childContainer(pathToDOM(parent, pos.path))
  let found = findByOffset(dom, pos.offset, true), inner
  if (!found) return {node: dom, offset: 0}
  if (found.node.getAttribute("pm-leaf") == "true" || !(inner = leafAt(found.node, found.innerOffset)))
    return {node: found.node.parentNode, offset: found.offset + (found.innerOffset ? 1 : 0)}
  else
    return inner
}

function windowRect() {
  return {left: 0, right: window.innerWidth,
          top: 0, bottom: window.innerHeight}
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
      moveY = -(rect.top - coords.top + scrollMargin)
    else if (coords.bottom > rect.bottom)
      moveY = coords.bottom - rect.bottom + scrollMargin
    if (coords.left < rect.left)
      moveX = -(rect.left - coords.left + scrollMargin)
    else if (coords.right > rect.right)
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
  let closest, dyClosest = 1e8, coordsClosest, offset = 0
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

export function setDOMSelectionToPos(pm, pos) {
  let {node, offset} = DOMFromPos(pm.content, pos)
  let range = document.createRange()
  range.setEnd(node, offset)
  range.setStart(node, offset)
  let sel = window.getSelection()
  sel.removeAllRanges()
  sel.addRange(range)
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
