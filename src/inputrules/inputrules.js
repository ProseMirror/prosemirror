const {Keymap, Plugin} = require("../edit")

// ;; Input rules are regular expressions describing a piece of text
// that, when typed, causes something to happen. This might be
// changing two dashes into an emdash, wrapping a paragraph starting
// with `"> "` into a blockquote, or something entirely different.
class InputRule {
  // :: (RegExp, ?string, union<string, (pm: ProseMirror, match: [string], pos: number)>)
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
exports.InputRule = InputRule

// ;; Manages the set of active input rules for an editor. Created
// with the `inputRules` plugin.
class InputRules {
  constructor(pm, options) {
    this.pm = pm
    this.rules = []
    this.cancelVersion = null

    pm.on.selectionChange.add(this.onSelChange = () => this.cancelVersion = null)
    pm.on.textInput.add(this.onTextInput = this.onTextInput.bind(this))
    pm.addKeymap(new Keymap({Backspace: pm => this.backspace(pm)}, {name: "inputRules"}), 20)

    options.rules.forEach(rule => this.addRule(rule))
  }

  detach() {
    this.pm.on.selectionChange.remove(this.onSelChange)
    this.pm.on.textInput.remove(this.onTextInput)
    this.pm.removeKeymap("inputRules")
  }

  // :: (InputRule)
  // Add the given input rule to the editor.
  addRule(rule) {
    this.rules.push(rule)
  }

  // :: (InputRule) → bool
  // Remove the given input rule from the editor. Returns false if the
  // rule wasn't found.
  removeRule(rule) {
    let found = this.rules.indexOf(rule)
    if (found > -1) {
      this.rules.splice(found, 1)
      return true
    }
    return false
  }

  onTextInput(text) {
    let $pos = this.pm.selection.$head
    if (!$pos) return

    let textBefore, isCode
    let lastCh = text[text.length - 1]

    for (let i = 0; i < this.rules.length; i++) {
      let rule = this.rules[i], match
      if (rule.filter && rule.filter != lastCh) continue
      if (textBefore == null) {
        ;({textBefore, isCode} = getContext($pos))
        if (isCode) return
      }
      if (match = rule.match.exec(textBefore)) {
        let startVersion = this.pm.history && this.pm.history.getVersion()
        if (typeof rule.handler == "string") {
          let start = $pos.pos - (match[1] || match[0]).length
          let marks = this.pm.doc.marksAt($pos.pos)
          this.pm.tr.delete(start, $pos.pos)
                    .insert(start, this.pm.schema.text(rule.handler, marks))
                    .apply()
        } else {
          rule.handler(this.pm, match, $pos.pos)
        }
        this.cancelVersion = startVersion
        return
      }
    }
  }

  backspace() {
    if (this.cancelVersion && this.pm.history) {
      this.pm.history.backToVersion(this.cancelVersion)
      this.cancelVersion = null
    } else {
      return false
    }
  }
}

function getContext($pos) {
  let parent = $pos.parent, isCode = parent.type.isCode
  let textBefore = ""
  for (let i = 0, rem = $pos.parentOffset; rem > 0; i++) {
    let child = parent.child(i)
    if (child.isText) textBefore += child.text.slice(0, rem)
    else textBefore += "\ufffc"
    rem -= child.nodeSize
    if (rem <= 0 && child.marks.some(st => st.type.isCode)) isCode = true
  }
  return {textBefore, isCode}
}

// :: Plugin
// A plugin for adding input rules to an editor. A common pattern of
// use is to call `inputRules.ensure(editor).addRule(...)` to get an
// instance of the plugin state and add a rule to it.
//
// Takes a single option, `rules`, which may be an array of
// `InputRules` objects to initially add.
const inputRules = new Plugin(InputRules, {
  rules: []
})
exports.inputRules = inputRules
