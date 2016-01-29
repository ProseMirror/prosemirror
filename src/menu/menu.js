import {Tooltip} from "../ui/tooltip"
import {elt, insertCSS} from "../dom"
import {defineDefaultParamHandler, withParamHandler, Command} from "../edit"
import sortedInsert from "../util/sortedinsert"
import {copyObj} from "../util/obj"
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

/// -------- NEW ----------

export class MenuCommand {
  constructor(command, options) {
    this.command_ = command
    this.options = options
  }

  command(pm) {
    return typeof this.command_ == "string" ? pm.commands[this.command_] : this.command_
  }

  render(pm) {
    let cmd = this.command(pm)
    // FIXME allow configuration over select behavior
    if (!cmd || !cmd.select(pm)) return

    let disp = this.options.display
    if (!disp) AssertionError.raise("No display style defined for menu command " + cmd.name)

    // FIXME allow extension of supported types
    let dom
    if (disp.type == "icon") {
      dom = getIcon(cmd.name, disp)
      if (cmd.active(pm)) dom.className += " ProseMirror-icon-active"
    } else if (disp.type == "label") {
      dom = elt("div", null, disp.label)
    } else {
      AssertionError.raise("Unsupported command display style: " + disp.type)
    }
    dom.setAttribute("title", title(pm, cmd))
    if (this.options.class) dom.classList.add(this.options.class)
    if (this.options.css) dom.style.cssText += this.options.css
    dom.addEventListener("mousedown", e => {
      e.preventDefault(); e.stopPropagation()
      pm.signal("menuReset")
      cmd.exec(pm)
    })
    return dom
  }

  static group(name, options) {
    return new MenuCommandGroup(name, options)
  }
}

class MenuCommandGroup {
  constructor(name, options) {
    this.name = name; this.options = options
  }

  collect(pm) {
    let result = []
    for (let name in pm.commands) {
      let cmd = pm.commands[name], spec = cmd.spec.menu
      if (spec && spec.group == this.name)
        sortedInsert(result, {cmd, rank: spec.rank == null ? 50 : spec.rank},
                     (a, b) => a.rank - b.rank)
    }
    return result.map(o => {
      let spec = o.cmd.spec.menu
      if (this.options) spec = copyObj(this.options, copyObj(spec))
      return new MenuCommand(o.cmd, spec)
    })
  }
}

let setID = 0

export class ControlSet {
  constructor(content) {
    this.content = Array.isArray(content) ? content : [content]
    this.id = this.content.some(e => e instanceof MenuCommandGroup) && "menuControls" + ++setID
  }

  get(pm) {
    if (this.id)
      return pm.cached[this.id] || this.build(pm)
    else
      return this.content
  }

  build(pm) {
    let result = []
    this.content.forEach(elt => {
      if (elt instanceof MenuCommandGroup)
        result = result.concat(elt.collect(pm))
      else
        result.push(elt)
    })
    let clear = () => {
      pm.cached[this.id] = null
      pm.off("commandsChanging", clear)
    }
    pm.on("commandsChanging", clear)
    return pm.cached[this.id] = result
  }
}

export class GroupedMenu {
  constructor(groups) {
    this.groups = groups.map(elt => new ControlSet(elt))
  }

  render(pm) {
    let result = [], needSep = false
    for (let i = 0; i < this.groups.length; i++) {
      let items = this.groups[i].get(pm), added = false
      for (let j = 0; j < items.length; j++) {
        let rendered = items[j].render(pm)
        if (rendered) {
          if (!added && needSep) result.push(elt("span", {class: prefix + "separator"}))
          result.push(elt("span", {class: prefix + "item"}, rendered))
          added = true
        }
      }
      if (added) needSep = true
    }
    if (result.length) return elt("div", null, result)
  }
}

export class Dropdown {
  constructor(options, content) {
    this.options = options || {}
    this.content = new ControlSet(content)
  }

  render(pm) {
    if (this.content.get(pm).length == 0) return

    let display = (this.options.displayActive && findActiveIn(this, pm)) || this.options.display
    let dom = elt("div", {class: prefix + "-dropdown " + (this.options.class || ""),
                          style: this.options.css,
                          title: this.options.label}, display)
    let open = null
    dom.addEventListener("mousedown", e => {
      e.preventDefault(); e.stopPropagation()
      if (open && open()) open = null
      else open = this.expand(pm, dom)
    })
    return dom
  }

  expand(pm, dom) {
    let rendered = renderDropdownItems(this.content.get(pm), pm)
    let menuDOM = elt("div", {class: prefix + "-dropdown-menu " + (this.options.className || "")},
                      rendered)

    let done = false
    function finish() {
      if (done) return
      done = true
      document.body.removeEventListener("mousedown", finish)
      document.body.removeEventListener("keydown", finish)
      pm.off("menuReset", finish)
      dom.removeChild(menuDOM)
      return true
    }
    pm.signal("menuReset")
    dom.appendChild(menuDOM)

    document.body.addEventListener("mousedown", finish)
    document.body.addEventListener("keydown", finish)
    pm.on("menuReset", finish)
    return finish
  }
}

function renderDropdownItems(items, pm) {
  let rendered = []
  for (let i = 0; i < items.length; i++) {
    let inner = items[i].render(pm)
    if (inner) rendered.push(elt("div", {class: prefix + "-dropdown-item"}, inner))
  }
  if (!rendered.length) rendered.push(elt("div", {class: prefix + "-dropdown-empty"}, "(empty)"))
  return rendered
}

function findActiveIn(element, pm) {
  let items = element.content.get(pm)
  for (let i = 0; i < items.length; i++) {
    let cur = items[i]
    if (cur instanceof MenuCommand) {
      let active = cur.command(pm).active(pm)
      if (active) return cur.options.activeDisplay
    } else if (cur instanceof DropdownSubmenu) {
      let found = findActiveIn(cur, pm)
      if (found) return found
    }
  }
}

export class DropdownSubmenu {
  constructor(options, content) {
    this.options = options || {}
    this.content = new ControlSet(content)
  }

  render(pm) {
    let items = this.content.get(pm)
    if (!items.length) return

    let label = elt("div", {class: prefix + "-submenu-label"}, this.options.label)
    let wrap = elt("div", {class: prefix + "-submenu-wrap"}, label,
                   elt("div", {class: prefix + "-submenu"}, renderDropdownItems(items, pm)))
    label.addEventListener("mousedown", e => {
      e.preventDefault(); e.stopPropagation()
      wrap.classList.toggle(prefix + "-submenu-wrap-active")
    })
    return wrap
  }
}

export const defaultMenu = new GroupedMenu([
  MenuCommand.group("inline"),
  new Dropdown({display: "Insert"}, MenuCommand.group("insert")),
  [new Dropdown({display: "Type..", displayActive: true, class: prefix + "-dropdown-textblock"},
                [MenuCommand.group("textblock"),
                 new DropdownSubmenu({label: "Heading"}, MenuCommand.group("textblockHeading"))]),
   MenuCommand.group("block")
  ],
  MenuCommand.group("history")
])

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

.${prefix}item {
  margin-right: 3px;
  display: inline-block;
}

.${prefix}separator {
  border-right: 1px solid #ddd;
  margin-right: 3px;
}

.${prefix}-dropdown {
  font-size: 90%;
}

.${prefix}-dropdown {
  padding: 1px 14px 1px 4px;
  display: inline-block;
  vertical-align: 1px;
  position: relative;
  cursor: pointer;
}

.${prefix}-dropdown:after {
  content: "";
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-top: 4px solid currentColor;
  opacity: .6;
  position: absolute;
  right: 2px;
  top: calc(50% - 2px);
}

.${prefix}-dropdown-textblock {
  min-width: 3em;
}

.${prefix}-dropdown-menu, .${prefix}-submenu {
  position: absolute;
  background: white;
  color: #666;
  border: 1px solid #ddd;
  padding: 2px;
}

.${prefix}-dropdown-menu {
  top: 100%;
  left: 0;
  z-index: 15;
  min-width: 6em;
}

.${prefix}-dropdown-item {
  cursor: pointer;
  padding: 2px 8px 2px 4px;
}

.${prefix}-dropdown-item:hover {
  background: #f2f2f2;
}

.${prefix}-dropdown-empty {
  opacity: 0.4;
}

.${prefix}-submenu-wrap {
  position: relative;
  margin-right: -4px;
}

.${prefix}-submenu-label:after {
  content: "";
  border-top: 4px solid transparent;
  border-bottom: 4px solid transparent;
  border-left: 4px solid currentColor;
  opacity: .6;
  position: absolute;
  right: 4px;
  top: calc(50% - 4px);
}

.${prefix}-submenu {
  display: none;
  min-width: 4em;
  left: 100%;
  top: -3px;
}

.${prefix}-submenu-wrap:hover .${prefix}-submenu, .${prefix}-submenu-wrap-active .${prefix}-submenu {
  display: block;
}
`)
