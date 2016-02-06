import {Pos, MarkType} from "../model"

import {Transform} from "./transform"
import {Step, StepResult} from "./step"
import {copyInline, copyStructure} from "./tree"

// !!
// **`addMark`**
//   : Add the `Mark` given as the step's parameter to all
//     inline content between `from` and `to` (when allowed).
//
// **`removeMark`**
//   : Remove the `Mark` given as the step's parameter from all inline
//     content between `from` and `to`.

Step.define("addMark", {
  apply(doc, step) {
    return new StepResult(copyStructure(doc, step.from, step.to, (node, from, to) => {
      if (!node.type.canContainMark(step.param)) return node
      return copyInline(node, from, to, node => {
        return node.mark(step.param.addToSet(node.marks))
      })
    }))
  },
  invert(step, _oldDoc, map) {
    return new Step("removeMark", step.from, map.map(step.to).pos, null, step.param)
  },
  paramToJSON(param) {
    return param.toJSON()
  },
  paramFromJSON(schema, json) {
    return schema.markFromJSON(json)
  }
})

// :: (Pos, Pos, Mark) → Transform
// Add the given mark to the inline content between `from` and `to`.
Transform.prototype.addMark = function(from, to, mark) {
  let removed = [], added = [], removing = null, adding = null
  this.doc.inlineNodesBetween(from, to, ({marks}, path, start, end, parent) => {
    if (mark.isInSet(marks) || !parent.type.canContainMark(mark.type)) {
      adding = removing = null
    } else {
      let rm = mark.type.isInSet(marks)
      if (rm) {
        if (removing && removing.param.eq(rm)) {
          removing.to = new Pos(path, end)
        } else {
          removing = new Step("removeMark", new Pos(path, start), new Pos(path, end), null, rm)
          removed.push(removing)
        }
      } else if (removing) {
        removing = null
      }
      if (adding) {
        adding.to = new Pos(path, end)
      } else {
        adding = new Step("addMark", new Pos(path, start), new Pos(path, end), null, mark)
        added.push(adding)
      }
    }
  })
  removed.forEach(s => this.step(s))
  added.forEach(s => this.step(s))
  return this
}

Step.define("removeMark", {
  apply(doc, step) {
    return new StepResult(copyStructure(doc, step.from, step.to, (node, from, to) => {
      return copyInline(node, from, to, node => {
        return node.mark(step.param.removeFromSet(node.marks))
      })
    }))
  },
  invert(step, _oldDoc, map) {
    return new Step("addMark", step.from, map.map(step.to).pos, null, step.param)
  },
  paramToJSON(param) {
    return param.toJSON()
  },
  paramFromJSON(schema, json) {
    return schema.markFromJSON(json)
  }
})

// :: (Pos, Pos, union<Mark, MarkType>) → Transform
// Remove the given mark, or all marks of the given type, from inline
// nodes between `from` and `to`.
Transform.prototype.removeMark = function(from, to, mark = null) {
  let matched = [], step = 0
  this.doc.inlineNodesBetween(from, to, ({marks}, path, start, end) => {
    step++
    let toRemove = null
    if (mark instanceof MarkType) {
      let found = mark.isInSet(marks)
      if (found) toRemove = [found]
    } else if (mark) {
      if (mark.isInSet(marks)) toRemove = [mark]
    } else {
      toRemove = marks
    }
    if (toRemove && toRemove.length) {
      path = path.slice()
      for (let i = 0; i < toRemove.length; i++) {
        let rm = toRemove[i], found
        for (let j = 0; j < matched.length; j++) {
          let m = matched[j]
          if (m.step == step - 1 && rm.eq(matched[j].style)) found = m
        }
        if (found) {
          found.to = new Pos(path, end)
          found.step = step
        } else {
          matched.push({style: rm, from: new Pos(path, start), to: new Pos(path, end), step: step})
        }
      }
    }
  })
  matched.forEach(m => this.step("removeMark", m.from, m.to, null, m.style))
  return this
}

// :: (Pos, Pos, ?NodeType) → Transform
// Remove all marks and non-text inline nodes, or if `newParent` is
// given, all marks and inline nodes that may not appear as content of
// `newParent`, from the given range.
Transform.prototype.clearMarkup = function(from, to, newParent) {
  let delSteps = [] // Must be accumulated and applied in inverse order
  this.doc.inlineNodesBetween(from, to, ({marks, type}, path, start, end) => {
    if (newParent ? !newParent.canContainType(type) : !type.isText) {
      path = path.slice()
      let from = new Pos(path, start)
      delSteps.push(new Step("replace", from, new Pos(path, end), from))
      return
    }
    for (let i = 0; i < marks.length; i++) {
      let mark = marks[i]
      if (!newParent || !newParent.canContainMark(mark.type)) {
        path = path.slice()
        this.step("removeMark", new Pos(path, start), new Pos(path, end), null, mark)
      }
    }
  })
  for (let i = delSteps.length - 1; i >= 0; i--) this.step(delSteps[i])
  return this
}
