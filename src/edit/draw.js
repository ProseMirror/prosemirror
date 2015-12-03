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

function deleteNextNodes(parent, at, amount) {
  for (let i = 0; i < amount; i++) {
    let prev = at
    at = at.nextSibling
    parent.removeChild(prev)
  }
  return at
}

export function redraw(pm, dirty, doc, prev) {
  let ranges = pm.ranges.activeRangeTracker()
  let path = []

  function scan(dom, node, prev) {
    let status = [], inPrev = [], inNode = []
    for (let i = 0, j = 0; i < prev.content.chunkLength && j < node.content.chunkLength; i++) {
      let cur = prev.content.chunkAt(i), dirtyStatus = dirty.get(cur)
      status.push(dirtyStatus)
      let matching = dirtyStatus ? -1 : node.content.chunkIndex(cur, j)
      if (matching > -1) {
        inNode[i] = matching
        inPrev[matching] = i
        j = matching + 1
      }
    }

    if (node.isTextblock) {
      let needsBR = node.size == 0 ||
          node.lastChild.type == node.type.schema.nodes.hard_break
      let last = dom.lastChild, hasBR = last && last.nodeType == 1 && last.hasAttribute("pm-force-br")
      if (needsBR && !hasBR)
        dom.appendChild(elt("br", {"pm-force-br": "true"}))
      else if (!needsBR && hasBR)
        dom.removeChild(last)
    }

    let domPos = dom.firstChild, prevIndex = 0, index = 0
    let textblock = node.isTextblock
    node.forEach((node, offset) => {
      if (!textblock) path.push(offset)
      let found = inPrev[index]
      let nodeLeft = true
      if (found != null) {
        domPos = deleteNextNodes(dom, domPos, found - prevIndex)
        prevIndex = found
      } else if (node && prevIndex < prev.content.chunkLength && inNode[prevIndex] == null &&
                 status[prevIndex] != 2 && node.sameMarkup(prev.content.chunkAt(prevIndex))) {
        scan(domPos, node, prev.content.chunkAt(prevIndex))
      } else {
        let rendered = renderNodeToDOM(node, options(path, ranges), offset)
        dom.insertBefore(rendered, domPos)
        nodeLeft = false
      }
      if (nodeLeft) {
        if (textblock) // FIXME use path for inline nodes as well
          domPos.setAttribute("pm-span", offset + "-" + (offset + node.width))
        else
          domPos.setAttribute("pm-path", offset)
        domPos = domPos.nextSibling
        prevIndex++
      }
      if (!textblock) path.pop()
      ++index
    })
    deleteNextNodes(dom, domPos, prev.content.chunkLength - prevIndex)
  }
  scan(pm.content, doc, prev)
}
