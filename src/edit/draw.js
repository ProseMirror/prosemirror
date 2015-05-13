import {toDOM, Pos} from "../model"

import {elt} from "./dom"

const nonEditable = {html_block: true, html_tag: true, horizontal_rule: true}

function options(path, ranges) {
  return {
    onRender(node, dom, offset) {
      if (node.type.type != "inline" && offset != null)
        dom.setAttribute("pm-path", offset)
      if (nonEditable.hasOwnProperty(node.type.name))
        dom.contentEditable = false
      return dom
    },
    renderInlineFlat(node, dom, offset) {
      ranges.advanceTo(new Pos(path, offset))
      let end = new Pos(path, offset + node.size)
      let nextCut = ranges.nextChangeBefore(end)

      let inner = dom, wrapped
      for (let i = 0; i < node.styles.length; i++) inner = inner.firstChild

      if (dom.nodeType != 1) {
        dom = elt("span", null, dom)
        if (!nextCut) wrapped = dom
      }
      if (!wrapped && (nextCut || ranges.current.length))
        wrapped = inner.parentNode.appendChild(elt("span", null, inner))
      dom.setAttribute("pm-inline-span", offset + "-" + end.offset)

      let inlineOffset = 0
      while (nextCut) {
        let size = nextCut - offset
        let split = splitSpan(wrapped, size)
        if (ranges.current.length)
          split.className = ranges.current.join(" ")
        split.setAttribute("pm-inline-offset", inlineOffset)
        inlineOffset += size
        offset += size
        ranges.advanceTo(new Pos(path, offset))
        if (!(nextCut = ranges.nextChangeBefore(end)))
          wrapped.setAttribute("pm-inline-offset", inlineOffset)
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
  pm.content.innerText = ""
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
    for (let i = 0, j = 0; i < node.content.length && j < prev.content.length; i++) {
      let dirtyStatus = dirty.get(node.content[i])
      status.push(dirtyStatus)
      let matching = dirtyStatus ? -1 : prev.content.indexOf(node.content[i], j)
      if (matching > -1) {
        inNode[matching] = i
        inPrev[i] = matching
        j = matching + 1
      }
    }

    let domPos = dom.firstChild, j = 0
    let block = node.type.block
    for (let i = 0, offset = 0; i < node.content.length; i++) {
      let child = node.content[i]
      let found = inPrev[i]
      let nodeLeft = true
      if (found > -1) {
        domPos = deleteNextNodes(dom, domPos, found - j)
        j = found
      } else if (!block && j < prev.content.length && inNode[j] == null &&
                 status[i] != 2 && child.sameMarkup(prev.content[j])) {
        path.push(i)
        scan(domPos, child, prev.content[j])
        path.pop()
      } else {
        dom.insertBefore(toDOM.renderNode(child, options(path, ranges), block ? offset : i), domPos)
        nodeLeft = false
      }
      if (nodeLeft) {
        if (block)
          domPos.setAttribute("pm-inline-span", offset + "-" + (offset + child.size))
        else
          domPos.setAttribute("pm-path", i)
        domPos = domPos.nextSibling
        j++
      }
      if (block) offset += child.size
    }
    deleteNextNodes(dom, domPos, prev.content.length - j)
  }
  scan(pm.content, doc, prev)
}
