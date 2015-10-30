import {Pos, containsStyle, StyleType} from "../model"

import {TransformResult, Transform} from "./transform"
import {defineStep, Step} from "./step"
import {copyInline, copyStructure} from "./tree"

defineStep("addStyle", {
  apply(doc, step) {
    return new TransformResult(copyStructure(doc, step.from, step.to, (node, from, to) => {
      if (!node.type.canContainStyle(step.param)) return node
      return copyInline(node, from, to, node => {
        return node.styled(step.param.addToSet(node.styles))
      })
    }))
  },
  invert(step, _oldDoc, map) {
    return new Step("removeStyle", step.from, map.map(step.to).pos, null, step.param)
  },
  paramToJSON(param) {
    return param.toJSON()
  },
  paramFromJSON(schema, json) {
    return schema.styleFromJSON(json)
  }
})


Transform.prototype.addStyle = function(from, to, st) {
  let removed = [], added = [], removing = null, adding = null
  this.doc.inlineNodesBetween(from, to, (span, start, end, path, parent) => {
    if (st.isInSet(span.styles) || !parent.type.canContainStyle(st.type)) {
      adding = removing = null
    } else {
      path = path.slice()
      let rm = containsStyle(span.styles, st.type)
      if (rm) {
        if (removing && removing.param.eq(rm)) {
          removing.to = new Pos(path, end)
        } else {
          removing = new Step("removeStyle", new Pos(path, start), new Pos(path, end), null, rm)
          removed.push(removing)
        }
      } else if (removing) {
        removing = null
      }
      if (adding) {
        adding.to = new Pos(path, end)
      } else {
        adding = new Step("addStyle", new Pos(path, start), new Pos(path, end), null, st)
        added.push(adding)
      }
    }
  })
  removed.forEach(s => this.step(s))
  added.forEach(s => this.step(s))
  return this
}

defineStep("removeStyle", {
  apply(doc, step) {
    return new TransformResult(copyStructure(doc, step.from, step.to, (node, from, to) => {
      return copyInline(node, from, to, node => {
        return node.styled(step.param.removeFromSet(node.styles))
      })
    }))
  },
  invert(step, _oldDoc, map) {
    return new Step("addStyle", step.from, map.map(step.to).pos, null, step.param)
  },
  paramToJSON(param) {
    return param.toJSON()
  },
  paramFromJSON(schema, json) {
    return schema.styleFromJSON(json)
  }
})

Transform.prototype.removeStyle = function(from, to, st = null) {
  let matched = [], step = 0
  this.doc.inlineNodesBetween(from, to, (span, start, end, path) => {
    step++
    let toRemove = null
    if (st instanceof StyleType) {
      let found = containsStyle(span.styles, st)
      if (found) toRemove = [found]
    } else if (st) {
      if (st.isInSet(span.styles)) toRemove = [st]
    } else {
      toRemove = span.styles
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
  matched.forEach(m => this.step("removeStyle", m.from, m.to, null, m.style))
  return this
}

Transform.prototype.clearMarkup = function(from, to, newParent) {
  let delSteps = [] // Must be accumulated and applied in inverse order
  this.doc.inlineNodesBetween(from, to, (span, start, end, path) => {
    if (newParent ? !newParent.canContainType(span.type) : !span.isText) {
      path = path.slice()
      let from = new Pos(path, start)
      delSteps.push(new Step("replace", from, new Pos(path, end), from))
      return
    }
    for (let i = 0; i < span.styles.length; i++) {
      let st = span.styles[i]
      if (!newParent || !newParent.canContainStyle(st.type)) {
        path = path.slice()
        this.step("removeStyle", new Pos(path, start), new Pos(path, end), null, st)
      }
    }
  })
  for (let i = delSteps.length - 1; i >= 0; i--) this.step(delSteps[i])
  return this
}
