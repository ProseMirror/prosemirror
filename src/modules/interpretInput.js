import {Node, Pos, style} from "../model"
import {defineModule} from "../module"

class Rule {
  constructor(match, handler) { this.match = match; this.handler = handler }
}

class InterpretInput {
  constructor() {
    this.rules = []
  }

  defineRule(match, handler) {
    this.rules.push(new Rule(match, handler))
  }

  defineReplacement(before, after) {
    let re = new RegExp(before.replace(/[^\w\s]/g, "\\$&") + "$")
    this.defineRule(re, function(pm, from, to) {
      pm.apply({name: "replace", pos: from, end: to, text: after})
    })
  }

  onTextInput(pm, pos) {
    let {textBefore, isCode} = getContext(pm.doc, pos)
    if (isCode) return

    for (let i = 0; i < this.rules.length; i++) {
      let rule = this.rules[i], match = rule.match.exec(textBefore)
      if (match) {
        let offset = pos.offset - (match[1] || match[0]).length
        return rule.handler(pm, new Pos(pos.path, offset), pos)
      }
    }
  }
}

defineModule("interpretInput", {
  init(pm) {
    let obj = new InterpretInput(pm)
    pm.on("textInput", (pm, _text, pos) => obj.onTextInput(pm, pos))
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
