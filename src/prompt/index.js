const {elt, insertCSS} = require("../util/dom")

// ;; This class represents a dialog that prompts for a set of
// fields.
class FieldPrompt {
  // :: (ProseMirror, string, [Field])
  // Construct a prompt. Note that this does not
  // [open](#FieldPrompt.open) it yet.
  constructor(pm, title, fields) {
    this.pm = pm
    this.title = title
    this.fields = fields
    this.doClose = null
    this.domFields = []
    for (let name in fields)
      this.domFields.push(fields[name].render(pm))

    let promptTitle = elt("h5", {}, pm.translate(title))
    let submitButton = elt("button", {type: "submit", class: "ProseMirror-prompt-submit"}, "Ok")
    let cancelButton = elt("button", {type: "button", class: "ProseMirror-prompt-cancel"}, "Cancel")
    cancelButton.addEventListener("click", () => this.close())
    // :: DOMNode
    // An HTML form wrapping the fields.
    this.form = elt("form", null, promptTitle, this.domFields.map(f => elt("div", null, f)),
                    elt("div", {class: "ProseMirror-prompt-buttons"}, submitButton, " ", cancelButton))
  }

  // :: ()
  // Close the prompt.
  close() {
    if (this.doClose) {
      this.doClose()
      this.doClose = null
    }
  }

  // :: ()
  // Open the prompt's dialog.
  open(callback) {
    this.close()
    let prompt = this.prompt()
    let hadFocus = this.pm.hasFocus()
    this.doClose = () => {
      prompt.close()
      if (hadFocus) setTimeout(() => this.pm.focus(), 50)
    }

    let submit = () => {
      let params = this.values()
      if (params) {
        this.close()
        callback(params)
      }
    }

    this.form.addEventListener("submit", e => {
      e.preventDefault()
      submit()
    })

    this.form.addEventListener("keydown", e => {
      if (e.keyCode == 27) {
        e.preventDefault()
        prompt.close()
      } else if (e.keyCode == 13 && !(e.ctrlKey || e.metaKey || e.shiftKey)) {
        e.preventDefault()
        submit()
      }
    })

    let input = this.form.elements[0]
    if (input) input.focus()
  }

  // :: () → ?[any]
  // Read the values from the form's field. Validate them, and when
  // one isn't valid (either has a validate function that produced an
  // error message, or has no validate function, no value, and no
  // default value), show the problem to the user and return `null`.
  values() {
    let result = Object.create(null), i = 0
    for (let name in this.fields) {
      let field = this.fields[name], dom = this.domFields[i++]
      let value = field.read(dom), bad = field.validate(value)
      if (bad) {
        this.reportInvalid(dom, this.pm.translate(bad))
        return null
      }
      result[name] = field.clean(value)
    }
    return result
  }

  // :: () → {close: ()}
  // Open a prompt with the parameter form in it. The default
  // implementation calls `openPrompt`.
  prompt() {
    return openPrompt(this.pm, this.form, {onClose: () => this.close()})
  }

  // :: (DOMNode, string)
  // Report a field as invalid, showing the given message to the user.
  reportInvalid(dom, message) {
    // FIXME this is awful and needs a lot more work
    let parent = dom.parentNode
    let style = "left: " + (dom.offsetLeft + dom.offsetWidth + 2) + "px; top: " + (dom.offsetTop - 5) + "px"
    let msg = parent.appendChild(elt("div", {class: "ProseMirror-invalid", style}, message))
    setTimeout(() => parent.removeChild(msg), 1500)
  }
}
exports.FieldPrompt = FieldPrompt

// ;; The type of field that `FieldPrompt` expects to be passed to it.
class Field {
  // :: (Object)
  // Create a field with the given options. Options support by all
  // field types are:
  //
  // **`value`**`: ?any`
  //   : The starting value for the field.
  //
  // **`label`**`: string`
  //   : The label for the field.
  //
  // **`required`**`: ?bool`
  //   : Whether the field is required.
  //
  // **`validate`**`: ?(any) → ?string`
  //   : A function to validate the given value. Should return an
  //     error message if it is not valid.
  constructor(options) { this.options = options }

  // :: (pm: ProseMirror) → DOMNode #path=Field.prototype.render
  // Render the field to the DOM. Should be implemented by all subclasses.

  // :: (DOMNode) → any
  // Read the field's value from its DOM node.
  read(dom) { return dom.value }

  // :: (any) → ?string
  // A field-type-specific validation function.
  validateType(_value) {}

  validate(value) {
    if (!value && this.options.required)
      return "Required field"
    return this.validateType(value) || (this.options.validate && this.options.validate(value))
  }

  clean(value) {
    return this.options.clean ? this.options.clean(value) : value
  }
}
exports.Field = Field

// ;; A field class for single-line text fields.
class TextField extends Field {
  render(pm) {
    return elt("input", {type: "text",
                         placeholder: pm.translate(this.options.label),
                         value: this.options.value || "",
                         autocomplete: "off"})
  }
}
exports.TextField = TextField


// ;; A field class for dropdown fields based on a plain `<select>`
// tag. Expects an option `options`, which should be an array of
// `{value: string, label: string}` objects, or a function taking a
// `ProseMirror` instance and returning such an array.
class SelectField extends Field {
  render(pm) {
    let opts = this.options
    let options = opts.options.call ? opts.options(pm) : opts.options
    return elt("select", null, options.map(o => elt("option", {value: o.value, selected: o.value == opts.value ? "true" : null},
                                                    pm.translate(o.label))))
  }
}
exports.SelectField = SelectField

// :: (ProseMirror, DOMNode, ?Object) → {close: ()}
// Open a dialog box for the given editor, putting `content` inside of
// it. The `close` method on the return value can be used to
// explicitly close the dialog again. The following options are
// supported:
//
// **`pos`**`: {left: number, top: number}`
//   : Provide an explicit position for the element. By default, it'll
//     be placed in the center of the editor.
//
// **`onClose`**`: fn()`
//   : A function to be called when the dialog is closed.
function openPrompt(pm, content, options) {
  let button = elt("button", {class: "ProseMirror-prompt-close"})
  let wrapper = elt("div", {class: "ProseMirror-prompt"}, content, button)
  let outerBox = pm.wrapper.getBoundingClientRect()

  pm.wrapper.appendChild(wrapper)
  if (options && options.pos) {
    wrapper.style.left = (options.pos.left - outerBox.left) + "px"
    wrapper.style.top = (options.pos.top - outerBox.top) + "px"
  } else {
    let blockBox = wrapper.getBoundingClientRect()
    let cX = Math.max(0, outerBox.left) + Math.min(window.innerWidth, outerBox.right) - blockBox.width
    let cY = Math.max(0, outerBox.top) + Math.min(window.innerHeight, outerBox.bottom) - blockBox.height
    wrapper.style.left = (cX / 2 - outerBox.left) + "px"
    wrapper.style.top = (cY / 2 - outerBox.top) + "px"
  }

  let close = () => {
    pm.on.interaction.remove(close)
    if (wrapper.parentNode) {
      wrapper.parentNode.removeChild(wrapper)
      if (options && options.onClose) options.onClose()
    }
  }
  button.addEventListener("click", close)
  pm.on.interaction.add(close)
  return {close}
}
exports.openPrompt = openPrompt

insertCSS(`
.ProseMirror-prompt {
  background: white;
  padding: 2px 6px 2px 15px;
  border: 1px solid silver;
  position: absolute;
  border-radius: 3px;
  z-index: 11;
}

.ProseMirror-prompt h5 {
  margin: 0;
  font-weight: normal;
  font-size: 100%;
  color: #444;
}

.ProseMirror-prompt input[type="text"],
.ProseMirror-prompt textarea {
  background: #eee;
  border: none;
  outline: none;
}

.ProseMirror-prompt input[type="text"] {
  padding: 0 4px;
}

.ProseMirror-prompt-close {
  position: absolute;
  left: 2px; top: 1px;
  color: #666;
  border: none; background: transparent; padding: 0;
}

.ProseMirror-prompt-close:after {
  content: "✕";
  font-size: 12px;
}

.ProseMirror-invalid {
  background: #ffc;
  border: 1px solid #cc7;
  border-radius: 4px;
  padding: 5px 10px;
  position: absolute;
  min-width: 10em;
}

.ProseMirror-prompt-buttons {
  margin-top: 5px;
  display: none;
}

`)
