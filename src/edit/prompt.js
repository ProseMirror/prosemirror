import {AssertionError} from "../util/error"
import {elt} from "../dom"

function paramDefault(param, pm, command) {
  if (param.prefill) {
    let prefill = param.prefill.call(command.self, pm)
    if (prefill != null) return prefill
  }
  return param.default
}

// :: Object<{render: (param: CommandParam, value: any) → DOMNode, read: (node: DOMNode) → any}>
// A collection of default renderers and readers for [parameter
// types](#CommandParam.type), which [parameter
// handlers](#commandParamHandler) can optionally use to prompt for
// parameters. `render` should create a form field for the parameter,
// and `read` should, given that field, return its value.
export const paramTypes = Object.create(null)

paramTypes.text = {
  render(param, value) {
    return elt("input", {type: "text",
                         placeholder: param.label,
                         value,
                         autocomplete: "off"})
  },
  read(dom) {
    return dom.value
  }
}

paramTypes.select = {
  render(param, value) {
    let options = param.options.call ? param.options(this) : param.options
    return elt("select", null, options.map(o => elt("option", {value: o.value, selected: o.value == value ? "true" : null}, o.label)))
  },
  read(dom) {
    return dom.value
  }
}

class ParamForm {
  constructor(pm, command) {
    this.pm
    this.command = command
    this.fields = command.params.map(param => {
      if (!(param.type in paramTypes))
        AssertionError.raise("Unsupported parameter type: " + param.type)
      return paramTypes[param.type].render.call(this.pm, param, paramDefault(param, pm, command))
    })
    this.form = elt("form", null, this.fields.map(f => elt("div", null, f)))
  }

  values() {
    let result = []
    for (let i = 0; i < this.command.params.length; i++) {
      let param = this.command.params[i], dom = this.fields[i]
      let type = paramTypes[param.type], value = type.read.call(this.pm, dom), bad
      if (param.validate)
        bad = param.validate(value)
      else if (!value && param.default == null)
        bad = "No default value available"

      if (bad) {
        if (type.reportInvalid)
          type.reportInvalid.call(this.pm, dom, bad)
        else
          defaultReportInvalid(dom, bad)
        return
      }
      result.push(value)
    }
    return result
  }
}

// FIXME this is awful and needs a lot more work
function defaultReportInvalid(dom, message) {
  let parent = dom.parentNode, box = dom.getBoundingClientRect()
  let style = "left: " + (dom.offsetLeft + dom.offsetWidth + 2) + "px; top: " + dom.offsetTop + "px"
  let msg = parent.appendChild(elt("div", {class: "ProseMirror-invalid", style}, message))
  setTimeout(() => parent.removeChild(msg), 1500)
}

export function defaultParamPrompt(pm, command) {
  let form = new ParamForm(pm, command)

  let prompt = pm.prompt(form.form)

  let submit = () => {
    let params = form.values()
    if (params) {
      prompt.close()
      command.exec(params)
    }
  }

  form.form.addEventListener("submit", e => {
    e.preventDefault()
    submit()
  })

  form.form.addEventListener("keydown", e => {
    if (e.keyCode == 27)
      prompt.close()
    else if (e.keyCode == 13 && !(e.ctrlKey || e.metaKey || e.shiftKey))
      submit()
  })

  let input = form.form.querySelector("input, textarea")
  if (input) input.focus()

  return prompt
}

export function defaultPrompt(pm, content, onClose) {
  let button = elt("button", {class: "ProseMirror-prompt-close"})
  let wrapper = elt("div", {class: "ProseMirror-prompt"}, content, button)
  let outerBox = pm.wrapper.getBoundingClientRect()

  pm.wrapper.appendChild(wrapper)
  let blockBox = wrapper.getBoundingClientRect()
  wrapper.style.left = (Math.max(0, outerBox.left) + Math.min(window.innerWidth, outerBox.right)
                        - blockBox.width) / 2 + "px"
  wrapper.style.top = (Math.max(0, outerBox.top) + Math.min(window.innerHeight, outerBox.bottom)
                       - blockBox.height) / 2 + "px"

  let close = () => {
    if (wrapper.parentNode) {
      wrapper.parentNode.removeChild(wrapper)
      if (onClose) onClose()
    }
  }
  button.addEventListener("click", close)
  return {close}
}
