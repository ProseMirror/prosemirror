import {elt, insertCSS} from "../dom"

// !! The `ui/prompt` module implements functionality for prompting
// the user for [command parameters](#CommandSpec.params).
//
// The default implementation gets the job done, roughly, but you'll
// probably want to customize it in your own system (or submit patches
// to improve this implementation).

// ;; This class represents a dialog that prompts for [command
// parameters](#CommandSpec.params). It is the default value of the
// `commandParamPrompt` option. You can set this option to a subclass
// (or a complete reimplementation) to customize the way in which
// parameters are read.
export class ParamPrompt {
  // :: (ProseMirror, Command)
  // Construct a prompt. Note that this does not
  // [open](#ParamPrompt.open) it yet.
  constructor(pm, command) {
    // :: ProseMirror
    this.pm = pm
    // :: Command
    this.command = command
    this.doClose = null
    // :: [DOMNode]
    // An array of fields, as created by `ParamTypeSpec.render`, for
    // the command's parameters.
    this.fields = command.params.map(param => {
      if (!(param.type in this.paramTypes))
        throw new RangeError("Unsupported parameter type: " + param.type)
      return this.paramTypes[param.type].render.call(this.pm, param, this.defaultValue(param))
    })
    let promptTitle = elt("h5", {}, (command.spec && command.spec.label) ? pm.translate(command.spec.label) : "")
    let submitButton = elt("button", {type: "submit", class: "ProseMirror-prompt-submit"}, "Ok")
    let cancelButton = elt("button", {type: "button", class: "ProseMirror-prompt-cancel"}, "Cancel")
    cancelButton.addEventListener("click", () => this.close())
    // :: DOMNode
    // An HTML form wrapping the fields.
    this.form = elt("form", null, promptTitle, this.fields.map(f => elt("div", null, f)),
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
  open() {
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
        this.command.exec(this.pm, params)
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
    let result = []
    for (let i = 0; i < this.command.params.length; i++) {
      let param = this.command.params[i], dom = this.fields[i]
      let type = this.paramTypes[param.type], value, bad
      if (type.validate)
        bad = type.validate(dom)
      if (!bad) {
        value = type.read.call(this.pm, dom)
        if (param.validate)
          bad = param.validate(value)
        else if (!value && param.default == null)
          bad = "No default value available"
      }

      if (bad) {
        if (type.reportInvalid)
          type.reportInvalid.call(this.pm, dom, bad)
        else
          this.reportInvalid(dom, bad)
        return null
      }
      result.push(value)
    }
    return result
  }

  // :: (CommandParam) → ?any
  // Get a parameter's default value, if any.
  defaultValue(param) {
    if (param.prefill) {
      let prefill = param.prefill.call(this.command.self, this.pm)
      if (prefill != null) return prefill
    }
    return param.default
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

// ;; #path=ParamTypeSpec #kind=interface
// By default, the prompting interface only knows how to prompt for
// parameters of type `text` and `select`. You can change the way
// those are prompted for, and define new types, by writing to
// `ParamPrompt.paramTypes`. All methods on these specs will be called
// with `this` bound to the relevant `ProseMirror` instance.

// :: (param: CommandParam, value: ?any) → DOMNode #path=ParamTypeSpec.render
// Create the DOM structure for a parameter field of this type, and
// pre-fill it with `value`, if given.

// :: (field: DOMNode) → any #path=ParamTypeSpec.read
// Read the value from the DOM field created by
// [`render`](#ParamTypeSpec.render).

// :: (field: DOMNode) → ?string #path=ParamTypeSpec.validate
// Optional. Validate the value in the given field, and return a
// string message if it is not a valid input for this type.

// :: (field: DOMNode, message: string) #path=ParamTypeSpec.reportInvalid
// Report the value in the given field as invalid, showing the given
// error message. This property is optional, and the prompt
// implementation will fall back to its own method of showing the
// message when it is not provided.

// :: Object<ParamTypeSpec>
// A collection of default renderers and readers for [parameter
// types](#CommandParam.type), which [parameter
// handlers](#commandParamHandler) can optionally use to prompt for
// parameters. `render` should create a form field for the parameter,
// and `read` should, given that field, return its value.
ParamPrompt.prototype.paramTypes = Object.create(null)

ParamPrompt.prototype.paramTypes.text = {
  render(param, value) {
    return elt("input", {type: "text",
                         placeholder: this.translate(param.label),
                         value,
                         autocomplete: "off"})
  },
  read(dom) {
    return dom.value
  }
}

ParamPrompt.prototype.paramTypes.select = {
  render(param, value) {
    let options = param.options.call ? param.options(this) : param.options
    return elt("select", null, options.map(o => elt("option", {value: o.value, selected: o.value == value ? "true" : null},
                                                    this.translate(o.label))))
  },
  read(dom) {
    return dom.value
  }
}

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
export function openPrompt(pm, content, options) {
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
    pm.off("interaction", close)
    if (wrapper.parentNode) {
      wrapper.parentNode.removeChild(wrapper)
      if (options && options.onClose) options.onClose()
    }
  }
  button.addEventListener("click", close)
  pm.on("interaction", close)
  return {close}
}

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
