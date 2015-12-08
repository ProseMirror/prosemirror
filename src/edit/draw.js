import {Pos} from "../model"
import {toDOM, renderNodeToDOM} from "../serialize/dom"

import {elt} from "../dom"

const nonEditable = {html_block: true, html_tag: true, horizontal_rule: true}

// FIXME clean up threading of path and offset, maybe remove from DOM renderer entirely

function options(path, ranges) {
  return {
    onRender(node, dom, offset) {
      if (!node.isInline && offset != null)
        dom.setAttribute("pm-path", offset)
      if (nonEditable.hasOwnProperty(node.type.name))
        dom.contentEditable = false
      return dom
    },
    renderInlineFlat(node, dom, offset) {
      ranges.advanceTo(new Pos(path, offset))
      let end = new Pos(path, offset + node.width)
      let nextCut = ranges.nextChangeBefore(end)

      let inner = dom, wrapped
      for (let i = 0; i < node.marks.length; i++) inner = inner.firstChild

      if (dom.nodeType != 1) {
        dom = elt("span", null, dom)
        if (!nextCut) wrapped = dom
      }
      if (!wrapped && (nextCut || ranges.current.length)) {
        wrapped = inner == dom ? (dom = elt("span", null, inner))
                               : inner.parentNode.appendChild(elt("span", null, inner))
      }

      dom.setAttribute("pm-span", offset + "-" + end.offset)
      if (!node.isText)
        dom.setAttribute("pm-span-atom", "true")

      let inlineOffset = 0
      while (nextCut) {
        let size = nextCut - offset
        let split = splitSpan(wrapped, size)
        if (ranges.current.length)
          split.className = ranges.current.join(" ")
        split.setAttribute("pm-span-offset", inlineOffset)
        inlineOffset += size
        offset += size
        ranges.advanceTo(new Pos(path, offset))
        if (!(nextCut = ranges.nextChangeBefore(end)))
          wrapped.setAttribute("pm-span-offset", inlineOffset)
      }

      if (ranges.current.length)
        wrapped.className = ranges.current.join(" ")
      return dom
    },
    document: document,
    path: path
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
  pm.content.appendChild(toDOM(doc, options([], pm.ranges.activeRangeTracker())))
}

// FIXME also deal with trailing empty text node somehow, or try to
// generalize the updating extra kludge nodes
function adjustTrailingBR(dom, node) {
  if (!node.isTextblock) return
  let needsBR = node.size == 0 ||
      node.lastChild.type == node.type.schema.nodes.hard_break
  let last = dom.lastChild, hasBR = last && last.nodeType == 1 && last.hasAttribute("pm-force-br")
  if (needsBR && !hasBR)
    dom.appendChild(elt("br", {"pm-force-br": "true"}))
  else if (!needsBR && hasBR)
    dom.removeChild(last)
}

function findNodeIn(iter, node) {
  let copy = iter.copy()
  for (let child; child = copy.next().value;) if (child == node) return child
}

function movePast(dom) {
  let next = dom.nextSibling
  dom.parentNode.removeChild(dom)
  return next
}

export function redraw(pm, dirty, doc, prev) {
  let ranges = pm.ranges.activeRangeTracker()
  let path = []

  function scan(dom, node, prev) {
    adjustTrailingBR(dom, node)

    let iNode = node.iter(), iPrev = prev.iter(), pChild = iPrev.next().value
    let domPos = dom.firstChild

    for (let child; child = iNode.next().value;) {
      let offset = iNode.offset - child.width, matching, reuseDOM
      if (!node.isTextblock) path.push(offset)

      if (pChild == child) {
        matching = pChild
      } else if (matching = findNodeIn(iPrev, child)) {
        while (pChild != matching) {
          pChild = iPrev.next().value
          domPos = movePast(domPos)
        }
      }

      if (matching && !dirty.get(matching)) {
        reuseDOM = true
      } else if (pChild && !child.isText && child.sameMarkup(pChild) && dirty.get(pChild) != 2) {
        reuseDOM = true
        scan(domPos, child, pChild)
      } else {
        let rendered = renderNodeToDOM(child, options(path, ranges), offset)
        dom.insertBefore(rendered, domPos)
        reuseDOM = false
      }

      if (reuseDOM) {
        if (node.isTextblock) // FIXME use path for inline nodes as well
          domPos.setAttribute("pm-span", offset + "-" + iNode.offset)
        else
          domPos.setAttribute("pm-path", offset)
        domPos = domPos.nextSibling
        pChild = iPrev.next().value
      }
      if (!node.isTextblock) path.pop()
    }

    while (pChild) {
      domPos = movePast(domPos)
      pChild = iPrev.next().value
    }
  }
  scan(pm.content, doc, prev)
}
