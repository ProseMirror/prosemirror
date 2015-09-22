import {Pos, Span, style, spanStylesAt} from "../model"

export function addInputRules(pm, rules) {
  if (!pm.mod.interpretInput)
    pm.mod.interpretInput = new InputRules(pm)
  pm.mod.interpretInput.addRules(rules)
}

export function removeInputRules(pm, rules) {
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
    this.cancelVersion = null

    pm.on("selectionChange", this.onSelChange = () => this.cancelVersion = null)
    pm.on("textInput", this.onTextInput = this.onTextInput.bind(this))
    pm.on("command_delBackward", this.delBackward = this.delBackward.bind(this))
  }

  unregister() {
    this.pm.off("selectionChange", this.onSelChange)
    this.pm.off("textInput", this.onTextInput)
    this.pm.off("command_delBackward", this.delBackward)
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

    let textBefore, isCode
    let lastCh = text[text.length - 1]

    for (let i = 0; i < this.rules.length; i++) {
      let rule = this.rules[i], match
      if (rule.lastChar && rule.lastChar != lastCh) continue
      if (textBefore == null) {
        ;({textBefore, isCode} = getContext(this.pm.doc, pos))
        if (isCode) return
      }
      if (match = rule.match.exec(textBefore)) {
        let startVersion = this.pm.history.getVersion()
        if (typeof rule.handler == "string") {
          let offset = pos.offset - (match[1] || match[0]).length
          let start = new Pos(pos.path, offset)
          let styles = spanStylesAt(this.pm.doc, pos)
          this.pm.apply(this.pm.tr.delete(start, pos).insert(start, Span.text(rule.handler, styles)))
        } else {
          rule.handler(this.pm, match, pos)
        }
        this.cancelVersion = startVersion
        return
      }
    }
  }

  delBackward() {
    if (this.cancelVersion) {
      this.pm.history.backToVersion(this.cancelVersion)
      this.cancelVersion = null
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
