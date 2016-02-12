import {Pos} from "../model"
import {Keymap} from "../edit"

// :: (ProseMirror, InputRule)
// Add the given [input rule](#InputRule) to an editor. From now on,
// whenever the rule's pattern is typed, its handler is activated.
//
// Note that the effect of an input rule can be canceled by pressing
// Backspace right after it happens.
export function addInputRule(pm, rule) {
  if (!pm.mod.interpretInput)
    pm.mod.interpretInput = new InputRules(pm)
  pm.mod.interpretInput.addRule(rule)
}

// :: (ProseMirror, InputRule)
// Remove the given rule (added earlier with `addInputRule`) from the
// editor.
export function removeInputRule(pm, rule) {
  let ii = pm.mod.interpretInput
  if (!ii) return
  ii.removeRule(rule)
  if (ii.rules.length == 0) {
    ii.unregister()
    pm.mod.interpretInput = null
  }
}

// ;; Input rules are regular expressions describing a piece of text
// that, when typed, causes something to happen. This might be
// changing two dashes into an emdash, wrapping a paragraph starting
// with `"> "` into a blockquote, or something entirely different.
export class InputRule {
  // :: (RegExp, ?string, union<string, (ProseMirror, [string], Pos)>)
  // Create an input rule. The rule applies when the user typed
  // something and the text directly in front of the cursor matches
  // `match`, which should probably end with `$`. You can optionally
  // provide a filter, which should be a single character that always
  // appears at the end of the match, and will be used to only apply
  // the rule when there's an actual chance of it succeeding.
  //
  // The `handler` can be a string, in which case the matched text
  // will simply be replaced by that string, or a function, which will
  // be called with the match array produced by
  // [`RegExp.exec`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/exec),
  // and should produce the effect of the rule.
  constructor(match, filter, handler) {
    this.filter = filter
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
    pm.addKeymap(new Keymap({Backspace: pm => this.backspace(pm)}, {name: "inputRules"}), 20)
  }

  unregister() {
    this.pm.off("selectionChange", this.onSelChange)
    this.pm.off("textInput", this.onTextInput)
    this.pm.removeKeymap("inputRules")
  }

  addRule(rule) {
    this.rules.push(rule)
  }

  removeRule(rule) {
    let found = this.rules.indexOf(rule)
    if (found > -1) {
      this.rules.splice(found, 1)
      return true
    }
  }

  onTextInput(text) {
    let pos = this.pm.selection.head
    if (!pos) return

    let textBefore, isCode
    let lastCh = text[text.length - 1]

    for (let i = 0; i < this.rules.length; i++) {
      let rule = this.rules[i], match
      if (rule.filter && rule.filter != lastCh) continue
      if (textBefore == null) {
        ;({textBefore, isCode} = getContext(this.pm.doc, pos))
        if (isCode) return
      }
      if (match = rule.match.exec(textBefore)) {
        let startVersion = this.pm.history.getVersion()
        if (typeof rule.handler == "string") {
          let offset = pos.offset - (match[1] || match[0]).length
          let start = new Pos(pos.path, offset)
          let marks = this.pm.doc.marksAt(pos)
          this.pm.tr.delete(start, pos)
                    .insert(start, this.pm.schema.text(rule.handler, marks))
                    .apply()
        } else {
          rule.handler(this.pm, match, pos)
        }
        this.cancelVersion = startVersion
        return
      }
    }
  }

  backspace() {
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
  let isCode = parent.type.isCode
  let textBefore = ""
  for (let i = parent.iter(0, pos.offset), child; child = i.next().value;) {
    if (child.isText) textBefore += child.text
    else textBefore = ""
    if (i.atEnd() && child.marks.some(st => st.type.isCode)) isCode = true
  }
  return {textBefore, isCode}
}
