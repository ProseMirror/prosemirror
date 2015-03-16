import {Node, Pos, style} from "../model"
import {defineModule} from "../module"

class Rule {
  constructor(match, handler) { this.match = match; this.handler = handler }
}

class InterpretInput {
  constructor(pm) {
    this.pm = pm
    this.rules = []
    this.afterState = this.beforeState = null
  }

  defineRule(match, handler) {
    this.rules.push(new Rule(match, handler))
  }

  onTextInput(pos) {
    let pos = this.pm.selection.head
    this.afterState = this.beforeState = null

    let {textBefore, isCode} = getContext(this.pm.doc, pos)
    if (isCode) return

    for (let i = 0; i < this.rules.length; i++) {
      let rule = this.rules[i], match = rule.match.exec(textBefore)
      if (match) {
        this.beforeState = this.pm.markState(true)
        if (typeof rule.handler == "string") {
          let offset = pos.offset - (match[1] || match[0]).length
          let start = new Pos(pos.path, offset)
          this.pm.apply({name: "replace", pos: start, end: pos, text: rule.handler})
        } else {
          rule.handler(this.pm, match, pos)
        }
        this.afterState = this.pm.markState(true)
        return
      }
    }
  }

  delBackward() {
    if (this.afterState && this.pm.isInState(this.afterState)) {
      this.pm.backToState(this.beforeState)
      this.afterState = this.beforeState = null
    } else {
      return false
    }
  }
}

defineModule("interpretInput", {
  init(pm) {
    let obj = new InterpretInput(pm)
    pm.on("textInput", () => obj.onTextInput())
    pm.extendCommand("delBackward", "high", () => obj.delBackward())
    return obj
  }
})

function getContext(doc, pos) {
  let parent = doc.path(pos.path)
  let isCode = parent.type == Node.types.code_block
  let textBefore = ""
  for (let offset = 0, i = 0; offset < pos.offset;) {
    let child = parent.content[i++], size = child.size
    textBefore += offset + size > pos.offset ? child.text.slice(0, pos.offset - offset) : child.text
    if (offset + size >= pos.offset) {
      if (child.styles.some(s => style.same(s, style.code)))
        isCode = true
      break
    }
    offset += size
  }
  return {textBefore, isCode}
}
