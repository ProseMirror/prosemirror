import {toDOM, nodeToDOM} from "../format"
import {elt, browser} from "../dom"

import {DIRTY_REDRAW} from "./main"
import {childContainer} from "./dompos"

function options(ranges) {
  return {
    pos: 0,
    preRenderContent() { this.pos++ },
    postRenderContent() { this.pos++ },

    onRender(node, dom, offset) {
      if (node.isBlock) {
        if (offset != null)
          dom.setAttribute("pm-offset", offset)
        dom.setAttribute("pm-size", node.nodeSize)
        if (node.isTextblock)
          adjustTrailingHacks(dom, node)
        if (dom.contentEditable == "false")
          dom = elt("div", null, dom)
        if (node.type.isLeaf) this.pos++
      }

      return dom
    },
    onContainer(node) {
      node.setAttribute("pm-container", true)
    },
    // : (Node, DOMNode, number) → DOMNode
    renderInlineFlat(node, dom, offset) {
      ranges.advanceTo(this.pos)
      let pos = this.pos, end = pos + node.nodeSize
      let nextCut = ranges.nextChangeBefore(end)

      let inner = dom, wrapped
      for (let i = 0; i < node.marks.length; i++) inner = inner.firstChild

      if (dom.nodeType != 1) {
        dom = elt("span", null, dom)
        if (nextCut == -1) wrapped = dom
      }
      if (!wrapped && (nextCut > -1 || ranges.current.length)) {
        wrapped = inner == dom ? (dom = elt("span", null, inner))
                               : inner.parentNode.appendChild(elt("span", null, inner))
      }

      dom.setAttribute("pm-offset", offset)
      dom.setAttribute("pm-size", node.nodeSize)

      let inlineOffset = 0
      while (nextCut > -1) {
        let size = nextCut - pos
        let split = splitSpan(wrapped, size)
        if (ranges.current.length)
          split.className = ranges.current.join(" ")
        split.setAttribute("pm-inner-offset", inlineOffset)
        inlineOffset += size
        ranges.advanceTo(nextCut)
        nextCut = ranges.nextChangeBefore(end)
        if (nextCut == -1)
          wrapped.setAttribute("pm-inner-offset", inlineOffset)
        pos += size
      }

      if (ranges.current.length)
        wrapped.className = ranges.current.join(" ")
      this.pos += node.nodeSize
      return dom
    },
    document
  }
}

function splitSpan(span, at) {
  let textNode = span.firstChild, text = textNode.nodeValue
  let newNode = span.parentNode.insertBefore(elt("span", null, text.slice(0, at)), span)
  textNode.nodeValue = text.slice(at)
  return newNode
}

export function draw(pm, doc) {
  pm.content.textContent = ""
  pm.content.appendChild(toDOM(doc, options(pm.ranges.activeRangeTracker())))
}

function adjustTrailingHacks(dom, node) {
  let needs = node.content.size == 0 || node.lastChild.type.isBR ||
      (node.type.isCode && node.lastChild.isText && /\n$/.test(node.lastChild.text))
      ? "br" : !node.lastChild.isText && node.lastChild.type.isLeaf ? "text" : null
  let last = dom.lastChild
  let has = !last || last.nodeType != 1 || !last.hasAttribute("pm-ignore") ? null
      : last.nodeName == "BR" ? "br" : "text"
  if (needs != has) {
    if (has) dom.removeChild(last)
    if (needs) dom.appendChild(needs == "br" ? elt("br", {"pm-ignore": "trailing-break"})
                               : elt("span", {"pm-ignore": "cursor-text"}, ""))
  }
}

function findNodeIn(parent, i, node) {
  for (; i < parent.childCount; i++) {
    let child = parent.child(i)
    if (child == node) return i
  }
  return -1
}

function movePast(dom) {
  let next = dom.nextSibling
  dom.parentNode.removeChild(dom)
  return next
}

export function redraw(pm, dirty, doc, prev) {
  if (dirty.get(prev) == DIRTY_REDRAW) return draw(pm, doc)

  let opts = options(pm.ranges.activeRangeTracker())

  function scan(dom, node, prev, pos) {
    let iPrev = 0, pChild = prev.firstChild
    let domPos = dom.firstChild

    for (let iNode = 0, offset = 0; iNode < node.childCount; iNode++) {
      let child = node.child(iNode), matching, reuseDOM
      let found = pChild == child ? iPrev : findNodeIn(prev, iPrev + 1, child)
      if (found > -1) {
        matching = child
        while (iPrev != found) {
          iPrev++
          domPos = movePast(domPos)
        }
      }

      if (matching && !dirty.get(matching)) {
        reuseDOM = true
      } else if (pChild && !child.isText && child.sameMarkup(pChild) && dirty.get(pChild) != DIRTY_REDRAW) {
        reuseDOM = true
        if (!pChild.type.isLeaf)
          scan(childContainer(domPos), child, pChild, pos + offset + 1)
      } else {
        opts.pos = pos + offset
        let rendered = nodeToDOM(child, opts, offset)
        dom.insertBefore(rendered, domPos)
        reuseDOM = false
      }

      if (reuseDOM) {
        domPos.setAttribute("pm-offset", offset)
        domPos.setAttribute("pm-size", child.nodeSize)
        domPos = domPos.nextSibling
        pChild = prev.maybeChild(++iPrev)
      }
      offset += child.nodeSize
    }

    while (pChild) {
      domPos = movePast(domPos)
      pChild = prev.maybeChild(++iPrev)
    }
    if (node.isTextblock) adjustTrailingHacks(dom, node)

    if (browser.ios) iosHacks(dom)
  }
  scan(pm.content, doc, prev, 0)
}

function iosHacks(dom) {
  if (dom.nodeName == "UL" || dom.nodeName == "OL") {
    let oldCSS = dom.style.cssText
    dom.style.cssText = oldCSS + "; list-style: square !important"
    window.getComputedStyle(dom).listStyle
    dom.style.cssText = oldCSS
  }
}
