import {style, Node} from "../model"

import {defineTransform, Result, Step} from "./transform"
import {nullMap} from "./map"
import {copyInline, copyStructure, findRanges, forSpansBetween} from "./tree"

defineTransform("addStyle", {
  apply(doc, data) {
    return new Result(doc, copyStructure(doc, data.from, data.to, (node, from, to) => {
      if (node.type == Node.types.code_block) return node
      return copyInline(node, from, to, node => {
        return new Node.Inline(node.type, style.add(node.styles, data.param),
                               node.text, node.attrs)
      })
    }))
  }
})

defineTransform("removeStyle", {
  apply(doc, data) {
    return new Result(doc, copyStructure(doc, data.from, data.to, (node, from, to) => {
      return copyInline(node, from, to, node => {
        let styles = node.styles
        if (typeof data.param == "string")
          styles = style.removeType(styles, data.param)
        else if (data.param)
          styles = style.remove(styles, data.param)
        else
          styles = Node.empty
        return new Node.Inline(node.type, styles, node.text, node.attrs)
      })
    }))
  }
})

export function addStyle(doc, from, to, st) {
  return findRanges(doc, from, to, span => !style.contains(span.styles, st))
    .map(range => new Step("addStyle", range.from, range.to, st))
}

export function removeStyle(doc, from, to, st) {
  return findRanges(doc, from, to, span => {
    if (typeof st == "string")
      return style.containsType(span.styles, st)
    else if (st)
      return style.contains(span.styles, st)
    else
      return span.styles.length > 0
  }).map(range => new Step("removeStyle", range.from, range.to, st))
}

export function clearMarkup(doc, from, to) {
  let steps = []
  forSpansBetween(doc, from, to, (span, path, start, end) => {
    if (span.type != Node.types.text) {
      path = path.slice()
      steps.unshift(new Step("delete", new Pos(path, start), new Pos(path, end)))
    }
  })
  steps.unshift(new Step("removeStyle", from, to, null))
  return steps
}
