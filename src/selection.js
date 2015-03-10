import Pos from "./model/pos"
import {findByPath} from "./dom"

export class Selection {
  constructor(pm) {
    this.pm = pm
    this.polling = null
    this.lastAnchorNode = this.lastHeadNode = this.lastAnchorOffset = this.lastHeadOffset = null
    let left = Pos.left(pm.doc)
    this.value = new Range(left, left)
    pm.content.addEventListener("focus", () => this.receivedFocus())
  }

  set(anchor, head) {
    this.value = new Range(anchor, head)
  }

  poll() {
    if (!selectionInNode(this.pm.content)) return
    let sel = getSelection()
    if (sel.anchorNode != this.lastAnchorNode || sel.anchorOffset != this.lastAnchorOffset ||
        sel.focusNode != this.lastHeadNode || sel.focusOffset != this.lastHeadOffset) {
      this.pm.setSelection(posFromDOM(this.pm, this.lastAnchorNode = sel.anchorNode,
                                      this.lastAnchorOffset = sel.anchorOffset),
                           posFromDOM(this.pm, this.lastHeadNode = sel.focusNode,
                                      this.lastHeadOffset = sel.focusOffset))
      return true
    }
  }

  toDOM(force) {
    let sel = window.getSelection()
    let content = this.pm.content
    if (!selectionInNode(content) ||
        !force &&
        sel.anchorNode == this.lastAnchorNode && sel.anchorOffset == this.lastAnchorOffset &&
        sel.focusNode == this.lastHeadNode && sel.focusOffset == this.lastHeadOffset)
      return

    let range = document.createRange()
    let anchor = DOMFromPath(content, this.value.anchor)
    let head = DOMFromPath(content, this.value.head)
    range.setEnd(anchor.node, anchor.offset)
    if (sel.extend)
      range.collapse()
    else
      range.setStart(head.node, head.offset)
    sel.removeAllRanges()
    sel.addRange(range)
    if (sel.extend)
      sel.extend(head.node, head.offset)

    this.lastAnchorNode = anchor.node; this.lastAnchorOffset = anchor.offset
    this.lastHeadNode = head.node; this.lastHeadOffset = head.offset
  }

  receivedFocus() {
    let content = this.sting.content
    let poll = () => {
      if (document.activeElement == this.sting.content) {
        if (!this.sting.operation) this.poll()
        clearTimeout(this.polling)
        this.polling = setTimeout(poll, 100)
      }
    }
    poll()
  }
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

function posFromDOM(pm, node, offset) {
  let path = [], nodeBefore = false
  for (let cur = node; cur != pm.content; cur = cur.parentNode) {
    let tag = cur.nodeType == 1 && cur.getAttribute("mm-path")
    if (tag) path.unshift(+tag)
    if (nodeBefore === false && cur.getAttribute("mm-inlinesize"))
      nodeBefore = cur.previousSibling
  }

  if (nodeBefore === false) nodeBefore = node.previousSibling
  for (; nodeBefore; nodeBefore = nodeBefore.previousSibling) {
    let size = nodeBefore.getAttribute("mm-inlinesize")
    if (size) offset += size
  }
  
  return new Pos(path, offset)
}

function findByPath(node, n) {
  for (let ch = node.firstChild; ch; ch = ch.nextSibling) {
    if (ch.nodeType != 1) continue;
    let path = ch.getAttribute("mm-path")
    if (!path) {
      let found = findByPath(ch, n)
      if (found) return found
    } else if (+path == n) {
      return ch
    }
  }
}

function findByOffset(node, offset) {
  function search(node) {
    if (node.nodeType != 1) return
    let size = node.getAttribute("mm-inlinesize")
    if (size) {
      if (size >= offset)
        return {node: node, offset: offset, atEnd: size == offset}
      offset -= size
    } else {
      for (let ch = node.firstChild; ch; ch = ch.nextSibling) {
        let result = search(ch)
        if (result) return result
      }
    }
  }
  search(node)
}

function DOMFromPos(node, pos) {
  for (let i = 0; i < pos.path.length; i++) {
    node = dom.findByPath(node, pos.path[i])
    if (!node) throw new Error("Failed to resolve pos " + pos)
  }
  let found = findByOffset(node, pos.offset)
  if (!found) throw new Error("Failed to resolve offset in " + pos)
  let child = found.node.firstChild
  if (!child.nextSibling && child.nodeType == 3)
    return {node: child, offset: found.offset}
  if (found.offset == 0) {
    let prev = found.node.previousSibling
    if (prev && prev.lastChild && prev.lastChild.nodeType == 3)
      return {node: prev.lastChild, offset: prev.lastChild.nodeValue.length}
    return {node: found.node, offset: 0}
  } else if (found.atEnd) {
    let next = found.node.nextSibling
    if (next && next.fistChild && next.firstChild.nodeValue == 3)
      return {node: next.firstChild, offset: 0}
    return {node: found.node, offset: found.node.childNodes.length}
  } else {
    throw new Error("Could not place cursor in node " + node.outerHTML)
  }
}

function selectionInNode(node) {
  var sel = window.getSelection();
  return sel.rangeCount && node.contains(sel.anchorNode);
}
