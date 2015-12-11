import {Pos, MarkType} from "../model"

import {TransformResult, Transform} from "./transform"
import {defineStep, Step} from "./step"
import {copyInline, copyStructure} from "./tree"

defineStep("addMark", {
  apply(doc, step) {
    return new TransformResult(copyStructure(doc, step.from, step.to, (node, from, to) => {
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


Transform.prototype.addMark = function(from, to, st) {
  let removed = [], added = [], removing = null, adding = null
  this.doc.inlineNodesBetween(from, to, ({marks}, path, start, end, parent) => {
    if (st.isInSet(marks) || !parent.type.canContainMark(st.type)) {
      adding = removing = null
    } else {
      let rm = st.type.isInSet(marks)
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
        adding = new Step("addMark", new Pos(path, start), new Pos(path, end), null, st)
        added.push(adding)
      }
    }
  })
  removed.forEach(s => this.step(s))
  added.forEach(s => this.step(s))
  return this
}

defineStep("removeMark", {
  apply(doc, step) {
    return new TransformResult(copyStructure(doc, step.from, step.to, (node, from, to) => {
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

Transform.prototype.removeMark = function(from, to, st = null) {
  let matched = [], step = 0
  this.doc.inlineNodesBetween(from, to, ({marks}, path, start, end) => {
    step++
    let toRemove = null
    if (st instanceof MarkType) {
      let found = st.isInSet(marks)
      if (found) toRemove = [found]
    } else if (st) {
      if (st.isInSet(marks)) toRemove = [st]
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
