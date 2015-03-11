import {Pos} from "./model"

export class Selection {
  constructor(pm) {
    this.pm = pm
    this.polling = null
    this.lastAnchorNode = this.lastHeadNode = this.lastAnchorOffset = this.lastHeadOffset = null
    let start = Pos.start(pm.doc)
    this.value = new Range(start, start)
    pm.content.addEventListener("focus", () => this.receivedFocus())
  }

  set(anchor, head) {
    this.value = new Range(ensureInBlock(this.pm.doc, anchor, this.value.anchor),
                           ensureInBlock(this.pm.doc, head, this.value.head))
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
    let anchor = DOMFromPos(content, this.value.anchor)
    let head = DOMFromPos(content, this.value.head)

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
    let content = this.pm.content
    let poll = () => {
      if (document.activeElement == this.pm.content) {
        if (!this.pm.operation) this.poll()
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

function attr(node, name) {
  return node.nodeType == 1 && node.getAttribute(name)
}

function posFromDOM(pm, node, domOffset) {
  let path = [], inText = false, offset = null, isBlock, prev
  
  if (node.nodeType == 3) {
    inText = true
    prev = node
    node = node.parentNode
  } else {
    prev = node.childNodes[domOffset]
  }

  for (let cur = node; cur != pm.content; prev = cur, cur = cur.parentNode) {
    let tag, range
    if (tag = cur.getAttribute("mm-path")) {
      path.unshift(+tag)
      if (offset == null) {
        offset = 0
        for (var scan = prev ? prev.previousSibling : cur.lastChild; scan; scan = scan.previousSibling) {
          if (tag = attr(scan, "mm-path")) {
            offset = +tag + 1
            break
          } else if (range = attr(scan, "mm-inline-span")) {
            offset = +/-(\d+)/.exec(range)[1]
            break
          }
        }
      }
    } else if (range = cur.getAttribute("mm-inline-span")) {
      let [_, from, to] = /(\d+)-(\d+)/.exec(range)
      if (inText)
        offset = +from + domOffset
      else
        offset = domOffset ? +to : +from
      isBlock = true
    }
  }
  if (offset == null) throw new Error("Failed to find pos")
  return new Pos(path, offset, isBlock)
}

function ensureInBlock(doc, pos, from) {
  if (pos.inBlock) return pos
  let dir = pos.cmp(from)
  let found = dir < 0 ? Pos.before(doc, pos) : Pos.after(doc, pos)
  if (!found)
    found = dir >= 0 ? Pos.before(doc, pos) : Pos.after(doc, pos)
  return found
}

export function findByPath(node, n) {
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
    let range = node.getAttribute("mm-inline-span")
    if (range) {
      let [_, from, to] = /(\d+)-(\d+)/.exec(range)
      if (+to >= offset)
        return {node: node, offset: offset - +from, atEnd: +to == offset}
    } else {
      for (let ch = node.firstChild; ch; ch = ch.nextSibling) {
        let result = search(ch)
        if (result) return result
      }
    }
  }
  return search(node)
}

function leaf(node) {
  while (node.firstChild) node = node.firstChild
  return node
}

function DOMFromPos(node, pos) {
  for (let i = 0; i < pos.path.length; i++) {
    node = findByPath(node, pos.path[i])
    if (!node) throw new Error("Failed to resolve pos " + pos)
  }
  let found = findByOffset(node, pos.offset)
  if (!found) return {node: node, offset: 0}
  let inner = leaf(found.node)
  if (inner.nodeType == 3)
    return {node: inner, offset: found.offset}
  let parent = found.node.parentNode
  let offset = Array.prototype.indexOf.call(parent.childNodes, found.node) + (found.offset ? 1 : 0)
  return {node: parent, offset: offset}
}

function selectionInNode(node) {
  var sel = window.getSelection();
  return sel.rangeCount && node.contains(sel.anchorNode);
}
