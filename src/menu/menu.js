import {Tooltip} from "../ui/tooltip"
import {elt, insertCSS} from "../dom"
import {defineDefaultParamHandler, withParamHandler, Command} from "../edit"
import sortedInsert from "../util/sortedinsert"
import {AssertionError} from "../util/error"

import {getIcon} from "./icons"

const prefix = "ProseMirror-menu"

// ;; #path=CommandSpec #kind=interface #noAnchor
// The `menu` module gives meaning to two additional properties of
// [command specs](#CommandSpec).

// :: string #path=CommandSpec.menuGroup
//
// Adds the command to the menugroup with the given name. The value
// may either be just a name (for example `"inline"` or `"block"`), or
// a name followed by a parenthesized rank (`"inline(40)"`) to control
// the order in which the commands appear in the group (from low to
// high, with 50 as default rank).

// :: Object #path=CommandSpec.display
//
// Determines how a command is shown in the menu. The object should
// have a `type` property, which picks a style of display. These types
// are supported:
//
// **`"icon"`**
//   : Show the command as an icon. The object may have `{path, width,
//     height}` properties, where `path` is an [SVG path
//     spec](https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/d),
//     and `width` and `height` provide the viewbox in which that path
//     exists. Alternatively, it may have a `text` property specifying
//     a string of text that makes up the icon, with an optional
//     `style` property giving additional CSS styling for the text.
//
// **`"param"`**
//   : Render command based on its first and only
//     [parameter](#CommandSpec.params), and immediately execute the
//     command when the parameter is changed. Currently only works for
//     `"select"` parameters.

export class Menu {
  constructor(pm, display, reset) {
    this.display = display
    this.stack = []
    this.pm = pm
    this.resetHandler = reset
    this.cssHint = ""
  }

  show(content, displayInfo) {
    this.stack.length = 0
    this.enter(content, displayInfo)
  }

  reset() {
    this.stack.length = 0
    this.resetHandler()
  }

  enter(content, displayInfo) {
    let pieces = [], close = false, explore = value => {
      let added = false
      if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) added = explore(value[i]) || added
        if (added) close = true
      } else if (!value.select || value.select(this.pm)) {
        if (close) {
          pieces.push(separator)
          close = false
        }
        pieces.push(value)
        added = true
      }
      return added
    }
    explore(content)

    if (!pieces.length) return this.display.clear()

    this.stack.push(pieces)
    this.draw(displayInfo)
  }

  get active() {
    return this.stack.length > 1
  }

  draw(displayInfo) {
    let cur = this.stack[this.stack.length - 1]
    let rendered = elt("div", {class: prefix}, cur.map(item => renderItem(item, this)))
    if (this.stack.length > 1)
      this.display.enter(rendered, () => this.leave(), displayInfo)
    else
      this.display.show(rendered, displayInfo)
  }

  leave() {
    this.stack.pop()
    if (this.display.leave)
      this.display.leave()
    else
      this.draw()
  }
}

export class TooltipDisplay {
  constructor(tooltip) {
    this.tooltip = tooltip
  }

  clear() {
    this.tooltip.close()
  }

  show(dom, info) {
    this.tooltip.open(dom, info)
  }

  enter(dom, back, info) {
    let button = elt("div", {class: "ProseMirror-tooltip-back", title: "Back"})
    button.addEventListener("mousedown", e => {
      e.preventDefault(); e.stopPropagation()
      back()
    })
    this.show(elt("div", {class: "ProseMirror-tooltip-back-wrapper"}, dom, button), info)
  }
}

function title(pm, command) {
  if (!command.label) return null
  let key = command.name && pm.keyForCommand(command.name)
  return key ? command.label + " (" + key + ")" : command.label
}

function execInMenu(menu, command, params) {
  withParamHandler((_, command, callback) => {
    menu.enter(readParams(command, callback))
  }, () => {
    command.exec(menu.pm, params)
  })
}

function renderIcon(command, menu) {
  let icon = getIcon(command.name, command.spec.display)
  if (command.active(menu.pm)) icon.className += " ProseMirror-icon-active"
  icon.addEventListener("mousedown", e => {
    e.preventDefault(); e.stopPropagation()
    execInMenu(menu, command)
  })
  return icon
}

function renderDropDown(item, menu) {
  let param = item.params[0]
  let deflt = paramDefault(param, menu.pm, item)
  if (deflt != null) {
    let options = param.options.call ? param.options(menu.pm) : param.options
    for (let i = 0; i < options.length; i++) if (options[i].value === deflt) {
      deflt = options[i]
      break
    }
  }

  let dom = elt("div", {class: "ProseMirror-dropdown ProseMirror-dropdown-command-" + item.name, title: item.label},
                !deflt ? (param.defaultLabel || "Select...") : deflt.display ? deflt.display(deflt) : deflt.label)
  let open = null
  dom.addEventListener("mousedown", e => {
    e.preventDefault(); e.stopPropagation()
    if (open && open()) open = null
    else open = expandDropDown(menu, item, dom)
  })
  return dom
}

export function expandDropDown(menu, item, dom) {
  let param = item.params[0], pm = menu.pm
  let options = param.options.call ? param.options(pm) : param.options
  let menuDOM = elt("div", {class: "ProseMirror-dropdown-menu " + menu.cssHint}, options.map(o => {
    let dom = elt("div", null, o.display ? o.display(o) : o.label)
    dom.addEventListener("mousedown", e => {
      e.preventDefault()
      execInMenu(menu, item, [o.value])
      finish()
    })
    return dom
  }))
  let pos = dom.getBoundingClientRect(), box = pm.wrapper.getBoundingClientRect()
  menuDOM.style.left = (pos.left - box.left) + "px"
  menuDOM.style.top = (pos.bottom - box.top) + "px"

  let done = false
  function finish() {
    if (done) return
    done = true
    document.body.removeEventListener("mousedown", finish)
    document.body.removeEventListener("keydown", finish)
    pm.wrapper.removeChild(menuDOM)
    return true
  }
  document.body.addEventListener("mousedown", finish)
  document.body.addEventListener("keydown", finish)
  pm.wrapper.appendChild(menuDOM)
  return finish
}

function renderItem(item, menu) {
  let dom
  if (item instanceof Command) {
    var display = item.spec.display
    if (display.type == "icon") dom = renderIcon(item, menu)
    else if (display.type == "param") dom = renderDropDown(item, menu)
    else AssertionError.raise("Command " + item.name + " can not be shown in a menu")
  } else {
    dom = item.display(menu)
  }
  return elt("span", {class: prefix + "item", title: title(menu.pm, item)}, dom)

}

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

function buildParamForm(pm, command) {
  let fields = command.params.map((param, i) => {
    if (!(param.type in paramTypes))
      AssertionError.raise("Unsupported parameter type: " + param.type)
    let field = paramTypes[param.type].render.call(pm, param, paramDefault(param, pm, command))
    field.setAttribute("data-field", i)
    return elt("div", null, field)
  })
  return elt("form", null, fields)
}

function gatherParams(pm, command, form) {
  let bad = false
  let params = command.params.map((param, i) => {
    let dom = form.querySelector("[data-field=\"" + i + "\"]")
    let val = paramTypes[param.type].read.call(pm, dom)
    if (val) return val
    if (param.default == null) bad = true
    else return paramDefault(param, pm, command)
  })
  return bad ? null : params
}

function paramForm(pm, command, callback) {
  let form = buildParamForm(pm, command), done = false

  let finish = result => {
    if (!done) {
      done = true
      callback(result)
    }
  }

  let submit = () => {
    // FIXME error messages
    finish(gatherParams(pm, command, form))
  }
  form.addEventListener("submit", e => {
    e.preventDefault()
    submit()
  })
  form.addEventListener("keydown", e => {
    if (e.keyCode == 27) {
      finish(null)
    } else if (e.keyCode == 13 && !(e.ctrlKey || e.metaKey || e.shiftKey)) {
      e.preventDefault()
      submit()
    }
  })
  // FIXME too hacky?
  setTimeout(() => {
    let input = form.querySelector("input, textarea")
    if (input) input.focus()
  }, 20)

  return form
}

export function readParams(command, callback) {
  return {display(menu) {
    return paramForm(menu.pm, command, params => {
      menu.pm.focus()
      if (params) {
        callback(params)
        menu.reset()
      } else {
        menu.leave()
      }
    })
  }}
}

const separator = {
  display() { return elt("span", {class: prefix + "separator"}) }
}

function menuRank(cmd) {
  let match = /^[^(]+\((\d+)\)$/.exec(cmd.spec.menuGroup)
  return match ? +match[1] : 50
}

function computeMenuGroups(pm) {
  let groups = Object.create(null)
  for (let name in pm.commands) {
    let cmd = pm.commands[name], spec = cmd.spec.menuGroup
    if (!spec) continue
    let [group] = /^[^(]+/.exec(spec)
    sortedInsert(groups[group] || (groups[group] = []), cmd, (a, b) => menuRank(a) - menuRank(b))
  }
  pm.mod.menuGroups = groups
  let clear = () => {
    pm.mod.menuGroups = null
    pm.off("commandsChanging", clear)
  }
  pm.on("commandsChanging", clear)
  return groups
}

const empty = []

export function menuGroups(pm, names) {
  let groups = pm.mod.menuGroups || computeMenuGroups(pm)
  return names.map(group => groups[group] || empty)
}

function tooltipParamHandler(pm, command, callback) {
  let tooltip = new Tooltip(pm.wrapper, "center")
  tooltip.open(paramForm(pm, command, params => {
    pm.focus()
    tooltip.close()
    callback(params)
  }))
}

defineDefaultParamHandler(tooltipParamHandler, false)

// FIXME check for obsolete styles
insertCSS(`

.${prefix} {
  margin: 0 -4px;
  line-height: 1;
}
.ProseMirror-tooltip .${prefix} {
  width: -webkit-fit-content;
  width: fit-content;
  white-space: pre;
}

.ProseMirror-tooltip-back-wrapper {
  padding-left: 12px;
}
.ProseMirror-tooltip-back {
  position: absolute;
  top: 5px; left: 5px;
  cursor: pointer;
}
.ProseMirror-tooltip-back:after {
  content: "«";
}

.${prefix}item {
  margin-right: 3px;
  display: inline-block;
}

.${prefix}separator {
  border-right: 1px solid #666;
}

.ProseMirror-dropdown, .ProseMirror-dropdown-menu {
  font-size: 90%;
}

.ProseMirror-dropdown {
  padding: 1px 14px 1px 4px;
  display: inline-block;
  vertical-align: 1px;
  position: relative;
  cursor: pointer;
}

.ProseMirror-dropdown:after {
  content: "⏷";
  font-size: 90%;
  opacity: .6;
  position: absolute;
  right: 2px;
}

.ProseMirror-dropdown-command-textblockType {
  min-width: 3em;
}

.ProseMirror-dropdown-menu {
  position: absolute;
  background: #444;
  color: white;
  padding: 2px;
  z-index: 15;
  min-width: 6em;
}
.ProseMirror-dropdown-menu div {
  cursor: pointer;
  padding: 2px 8px 2px 4px;
}
.ProseMirror-dropdown-menu div:hover {
  background: #777;
}

`)
