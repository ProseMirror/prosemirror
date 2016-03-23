import {MarkType, Fragment} from "../model"

import {Transform} from "./transform"
import {Step, StepResult} from "./step"

// !!
// **`addMark`**
//   : Add the `Mark` given as the step's parameter to all
//     inline content between `from` and `to` (when allowed).
//
// **`removeMark`**
//   : Remove the `Mark` given as the step's parameter from all inline
//     content between `from` and `to`.

function mapNode(node, f, parent) {
  if (node.content.size) node = node.copy(mapFragment(node.content, f, node))
  if (node.isInline) node = f(node, parent)
  return node
}

function mapFragment(fragment, f, parent) {
  let mapped = []
  for (let i = 0; i < fragment.childCount; i++)
    mapped.push(mapNode(fragment.child(i), f, parent))
  return Fragment.fromArray(mapped)
}

Step.define("addMark", {
  apply(doc, step) {
    let slice = doc.slice(step.from, step.to), pos = doc.resolve(step.from)
    slice.content = mapFragment(slice.content, (node, parent) => {
      if (!parent.type.canContainMark(step.param.type)) return node
      return node.mark(step.param.addToSet(node.marks))
    }, pos.node(pos.depth - slice.openLeft))
    return StepResult.fromReplace(doc, step.from, step.to, slice)
  },
  invert(step) {
    return new Step("removeMark", step.from, step.to, step.param)
  },
  paramToJSON(param) {
    return param.toJSON()
  },
  paramFromJSON(schema, json) {
    return schema.markFromJSON(json)
  }
})

// :: (number, number, Mark) → Transform #path=Transform.prototype.addMark
// Add the given mark to the inline content between `from` and `to`.
Transform.define("addMark", function(from, to, mark) {
  let removed = [], added = [], removing = null, adding = null
  this.doc.nodesBetween(from, to, (node, pos, parent) => {
    if (!node.isInline) return
    let marks = node.marks
    if (mark.isInSet(marks) || !parent.type.canContainMark(mark.type)) {
      adding = removing = null
    } else {
      let start = Math.max(pos, from), end = Math.min(pos + node.nodeSize, to)
      let rm = mark.type.isInSet(marks)

      if (!rm)
        removing = null
      else if (removing && removing.param.eq(rm))
        removing.to = end
      else
        removed.push(removing = new Step("removeMark", start, end, rm))

      if (adding)
        adding.to = end
      else
        added.push(adding = new Step("addMark", start, end, mark))
    }
  })

  removed.forEach(s => this.step(s))
  added.forEach(s => this.step(s))
})

Step.define("removeMark", {
  apply(doc, step) {
    let slice = doc.slice(step.from, step.to)
    slice.content = mapFragment(slice.content, node => {
      return node.mark(step.param.removeFromSet(node.marks))
      if (!parent.type.canContainMark(step.param.type)) return node
      return node.mark(step.param.addToSet(node.marks))
    })
    return StepResult.fromReplace(doc, step.from, step.to, slice)
  },
  invert(step) {
    return new Step("addMark", step.from, step.to, step.param)
  },
  paramToJSON(param) {
    return param.toJSON()
  },
  paramFromJSON(schema, json) {
    return schema.markFromJSON(json)
  }
})

// :: (number, number, ?union<Mark, MarkType>) → Transform
// #path=Transform.prototype.removeMark
// Remove the given mark, or all marks of the given type, from inline
// nodes between `from` and `to`.
Transform.define("removeMark", function(from, to, mark = null) {
  let matched = [], step = 0
  this.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isInline) return
    step++
    let toRemove = null
    if (mark instanceof MarkType) {
      let found = mark.isInSet(node.marks)
      if (found) toRemove = [found]
    } else if (mark) {
      if (mark.isInSet(node.marks)) toRemove = [mark]
    } else {
      toRemove = node.marks
    }
    if (toRemove && toRemove.length) {
      let end = Math.min(pos + node.nodeSize, to)
      for (let i = 0; i < toRemove.length; i++) {
        let style = toRemove[i], found
        for (let j = 0; j < matched.length; j++) {
          let m = matched[j]
          if (m.step == step - 1 && style.eq(matched[j].style)) found = m
        }
        if (found) {
          found.to = end
          found.step = step
        } else {
          matched.push({style, from: Math.max(pos, from), to: end, step})
        }
      }
    }
  })
  matched.forEach(m => this.step("removeMark", m.from, m.to, m.style))
})

// :: (number, number, ?NodeType) → Transform #path=Transform.prototype.clearMarkup
// Remove all marks and non-text inline nodes, or if `newParent` is
// given, all marks and inline nodes that may not appear as content of
// `newParent`, from the given range.
Transform.define("clearMarkup", function(from, to, newParent) {
  let delSteps = [] // Must be accumulated and applied in inverse order
  this.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isInline) return
    if (newParent ? !newParent.canContainType(node.type) : !node.type.isText) {
      delSteps.push(new Step("replace", pos, pos + node.nodeSize))
      return
    }
    for (let i = 0; i < node.marks.length; i++) {
      let mark = node.marks[i]
      if (!newParent || !newParent.canContainMark(mark.type))
        this.step("removeMark", Math.max(pos, from), Math.min(pos + node.nodeSize, to), mark)
    }
  })
  for (let i = delSteps.length - 1; i >= 0; i--) this.step(delSteps[i])
})
