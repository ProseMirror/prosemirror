import {Pos} from "../model"

import {contains, browser} from "../dom"

export class Selection {
  constructor(pm) {
    this.pm = pm
    this.polling = null
    this.lastAnchorNode = this.lastHeadNode = this.lastAnchorOffset = this.lastHeadOffset = null
    let start = Pos.start(pm.doc)
    this.range = new Range(start, start)
    pm.content.addEventListener("focus", () => this.receivedFocus())
  }

  setAndSignal(range, clearLast) {
    this.set(range, clearLast)
    this.pm.signal("selectionChange")
  }

  set(range, clearLast) {
    this.range = range
    if (clearLast !== false) this.lastAnchorNode = null
  }

  poll(force) {
    if (this.pm.input.composing || !hasFocus(this.pm)) return
    let sel = getSelection()
    if (force || sel.anchorNode != this.lastAnchorNode || sel.anchorOffset != this.lastAnchorOffset ||
        sel.focusNode != this.lastHeadNode || sel.focusOffset != this.lastHeadOffset) {
      let {pos: anchor, inline: anchorInline} =
          posFromDOM(this.pm, sel.anchorNode, sel.anchorOffset, force)
      let {pos: head, inline: headInline} =
          posFromDOM(this.pm, sel.focusNode, sel.focusOffset, force)
      this.lastAnchorNode = sel.anchorNode; this.lastAnchorOffset = sel.anchorOffset
      this.lastHeadNode = sel.focusNode; this.lastHeadOffset = sel.focusOffset
      this.pm.sel.setAndSignal(new Range(anchorInline ? anchor : moveInline(this.pm.doc, anchor, this.range.anchor),
                                         headInline ? head: moveInline(this.pm.doc, head, this.range.head)), false)
      if (this.range.anchor.cmp(anchor) || this.range.head.cmp(head))
        this.toDOM(true)
      return true
    }
  }

  toDOM(force, takeFocus) {
    let sel = window.getSelection()
    if (!hasFocus(this.pm)) {
      if (!takeFocus) return
      // See https://bugzilla.mozilla.org/show_bug.cgi?id=921444
      else if (browser.gecko) this.pm.content.focus()
    }
    if (!force &&
        sel.anchorNode == this.lastAnchorNode && sel.anchorOffset == this.lastAnchorOffset &&
        sel.focusNode == this.lastHeadNode && sel.focusOffset == this.lastHeadOffset)
      return

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
    let poll = () => {
      if (document.activeElement == this.pm.content) {
        if (!this.pm.operation) this.poll()
        clearTimeout(this.polling)
        this.polling = setTimeout(poll, 50)
      }
    }
    this.polling = setTimeout(poll, 20)
  }
}

function windowRect() {
  return {left: 0, right: window.innerWidth,
          top: 0, bottom: window.innerHeight}
}

export class Range {
  constructor(anchor, head) {
    this.anchor = anchor
    this.head = head
  }

  get inverted() { return this.anchor.cmp(this.head) > 0 }
  get from() { return this.inverted ? this.head : this.anchor }
  get to() { return this.inverted ? this.anchor : this.head }
  get empty() { return this.anchor.cmp(this.head) == 0 }
}

function attr(node, name) {
  return node.nodeType == 1 && node.getAttribute(name)
}

function scanOffset(node, parent) {
  for (var scan = node ? node.previousSibling : parent.lastChild; scan; scan = scan.previousSibling) {
    let tag, range
    if (tag = attr(scan, "pm-path"))
      return +tag + 1
    else if (range = attr(scan, "pm-span"))
      return +/-(\d+)/.exec(range)[1]
  }
  return 0
}

function posFromDOM(pm, node, domOffset, force) {
  if (!force && pm.operation && pm.doc != pm.operation.doc)
    throw new Error("Fetching a position from an outdated DOM structure")

  let path = [], inText = false, offset = null, inline = false, prev

  if (node.nodeType == 3) {
    inText = true
    prev = node
    node = node.parentNode
  } else {
    prev = node.childNodes[domOffset]
  }

  for (let cur = node; cur != pm.content; prev = cur, cur = cur.parentNode) {
    let tag, range
    if (tag = cur.getAttribute("pm-path")) {
      path.unshift(+tag)
      if (offset == null)
        offset = scanOffset(prev, cur)
    } else if (range = cur.getAttribute("pm-span")) {
      let [_, from, to] = /(\d+)-(\d+)/.exec(range)
      if (inText)
        offset = +from + domOffset
      else
        offset = domOffset ? +to : +from
      inline = true
    } else if (inText && (tag = cur.getAttribute("pm-span-offset"))) {
      domOffset += +tag
    }
  }
  if (offset == null) offset = scanOffset(prev, node)
  return {pos: new Pos(path, offset), inline}
}

function moveInline(doc, pos, from) {
  let dir = pos.cmp(from)
  let found = dir < 0 ? Pos.before(doc, pos) : Pos.after(doc, pos)
  if (!found)
    found = dir >= 0 ? Pos.before(doc, pos) : Pos.after(doc, pos)
  return found
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

function findByOffset(node, offset) {
  function search(node, domOffset) {
    if (node.nodeType != 1) return
    let range = node.getAttribute("pm-span")
    if (range) {
      let [_, from, to] = /(\d+)-(\d+)/.exec(range)
      if (+to >= offset)
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

  let {pos, inline} = posFromDOM(pm, element, offset)
  return inline ? pos : moveInline(pm.doc, pos, pos)
}

export function coordsAtPos(pm, pos) {
  let {node, offset} = DOMFromPos(pm.content, pos)
  let rect
  if (node.nodeType == 3 && node.nodeValue) {
    let range = document.createRange()
    range.setEnd(node, offset ? offset : offset + 1)
    range.setStart(node, offset ? offset - 1 : offset)
    rect = range.getBoundingClientRect()
  } else if (node.nodeType == 1 && node.firstChild) {
    rect = node.childNodes[offset ? offset - 1 : offset].getBoundingClientRect()
    // BR nodes are likely to return a useless empty rectangle. Try
    // the node on the other side in that case.
    if (rect.left == rect.right && offset && offset < node.childNodes.length) {
      let otherRect = node.childNodes[offset].getBoundingClientRect()
      if (otherRect.left != otherRect.right)
        rect = {top: otherRect.top, bottom: otherRect.bottom, right: otherRect.left}
    }
  } else {
    rect = node.getBoundingClientRect()
  }
  let x = offset ? rect.right : rect.left
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

function offsetInRects(coords, rects) {
  let {top: y, left: x} = coords
  let minY = 1e5, minX = 1e5, offset = 0
  for (let i = 0; i < rects.length; i++) {
    let rect = rects[i]
    if (!rect || (rect.top == 0 && rect.bottom == 0)) continue
    let dY = y < rect.top ? rect.top - y : y > rect.bottom ? y - rect.bottom : 0
    if (dY > minY) continue
    if (dY < minY) { minY = dY; minX = 1e5 }
    let dX = x < rect.left ? rect.left - x : x > rect.right ? x - rect.right : 0
    if (dX < minX) {
      minX = dX
      offset = Math.abs(x - rect.left) < Math.abs(x - rect.right) ? i : i + 1
    }
  }
  return offset
}

function offsetInTextNode(text, coords) {
  let len = text.nodeValue.length
  let range = document.createRange()
  let rects = []
  for (let i = 0; i < len; i++) {
    range.setEnd(text, i + 1)
    range.setStart(text, i)
    rects.push(range.getBoundingClientRect())
  }
  return offsetInRects(coords, rects)
}

function offsetInElement(element, coords) {
  let rects = []
  for (let child = element.firstChild; child; child = child.nextSibling)
    rects.push(child.getBoundingClientRect())
  return offsetInRects(coords, rects)
}
