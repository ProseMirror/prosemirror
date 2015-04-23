import {Node, Pos, style} from "../model"

export function addInputRules(pm, rules) {
  if (!pm.mod.interpretInput)
    pm.mod.interpretInput = new InputRules(pm)
  pm.mod.interpretInput.addRules(rules)
}

export function removeInputRule(pm, rules) {
  let ii = pm.mod.interpretInput
  if (!ii) return
  ii.removeRules(rules)
  if (ii.rules.length == 0) {
    ii.unregister()
    pm.mod.interpretInput = null
  }
}

export class Rule {
  constructor(lastChar, match, handler) {
    this.lastChar = lastChar
    this.match = match
    this.handler = handler
  }
}

class InputRules {
  constructor(pm) {
    this.pm = pm
    this.rules = []
    this.afterState = this.beforeState = null

    pm.on("textInput", this.onTextInput = this.onTextInput.bind(this))
    pm.extendCommand("delBackward", "high", this.delBackward = this.delBackward.bind(this))
  }

  unregister() {
    pm.off("textInput", this.onTextInput)
    pm.unextendCommand("delBackward", "high", this.delBackward)
  }

  addRules(rules) {
    this.rules = this.rules.concat(rules)
  }

  removeRules(rules) {
    for (let i = 0; i < rules.length; i++) {
      let found = this.rules.indexOf(rules[i])
      if (found > -1) this.rules.splice(found, 1)
    }
  }

  onTextInput(text) {
    let pos = this.pm.selection.head
    this.afterState = this.beforeState = null

    let textBefore, isCode
    let lastCh = text[text.length - 1]
    
    for (let i = 0; i < this.rules.length; i++) {
      let rule = this.rules[i], match
      if (rule.lastChar && rule.lastChar != lastCh) continue
      if (textBefore == null) {
        ({textBefore, isCode}) = getContext(this.pm.doc, pos)
        if (isCode) return
      }
      if (match = rule.match.exec(textBefore)) {
        this.beforeState = this.pm.markState(true)
        if (typeof rule.handler == "string") {
          let offset = pos.offset - (match[1] || match[0]).length
          let start = new Pos(pos.path, offset)
          this.pm.apply(pm.tr.insertText(start, rule.handler, pos))
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

function getContext(doc, pos) {
  let parent = doc.path(pos.path)
  let isPlain = parent.type.plainText
  let textBefore = ""
  for (let offset = 0, i = 0; offset < pos.offset;) {
    let child = parent.content[i++], size = child.size
    textBefore += offset + size > pos.offset ? child.text.slice(0, pos.offset - offset) : child.text
    if (offset + size >= pos.offset) {
      if (style.contains(child.styles, style.code))
        isPlain = true
      break
    }
    offset += size
  }
  return {textBefore, isPlain}
}
