import {Tooltip} from "./tooltip"
import {elt, insertCSS} from "../dom"
import {defineParamHandler} from "../edit"
import sortedInsert from "../util/sortedinsert"
import {getIcon} from "./icons"

export class Menu {
  constructor(pm, display) {
    this.display = display
    this.stack = []
    this.pm = pm
  }

  show(content, displayInfo) {
    this.stack.length = 0
    this.enter(content, displayInfo)
  }

  reset() {
    this.stack.length = 0
    this.display.reset()
  }

  enter(content, displayInfo) {
    let pieces = [], explore = value => {
      if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) explore(value[i])
        pieces.push(separator)
      } else if (!value.select || value.select(this.pm)) {
        pieces.push(value)
      }
    }
    explore(content)
    // Remove superfluous separators
    for (let i = 0; i < pieces.length; i++)
      if (pieces[i] == separator && (i == 0 || i == pieces.length - 1 || pieces[i + 1] == separator))
        pieces.splice(i--, 1)

    if (!pieces.length) return this.display.clear()

    this.stack.push(pieces)
    this.draw(displayInfo)
  }

  get active() {
    return this.stack.length > 1
  }

  draw(displayInfo) {
    let cur = this.stack[this.stack.length - 1]
    let rendered = elt("div", {class: "ProseMirror-menu"}, cur.map(item => renderItem(item, this)))
    if (this.stack.length > 1)
      this.display.enter(rendered, () => this.leave(), displayInfo)
    else
      this.display.show(rendered, displayInfo)
  }

  leave() {
    this.stack.pop()
    if (this.stack.length)
      this.draw()
    else
      this.display.reset()
  }
}

export class TooltipDisplay {
  constructor(tooltip, resetFunc) {
    this.tooltip = tooltip
    this.resetFunc = resetFunc
  }

  clear() {
    this.tooltip.close()
  }

  reset() {
    if (this.resetFunc) this.resetFunc()
    else this.clear()
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
  let key = pm.keyForCommand(command.name)
  return key ? command.label + " (" + key + ")" : command.label
}

function renderIcon(command, menu) {
  let icon = resolveIcon(menu.pm, command)
  if (command.active(menu.pm)) icon.className += " ProseMirror-icon-active"
  let dom = elt("span", {class: "ProseMirror-menuicon", title: title(menu.pm, command)}, icon)
  dom.addEventListener("mousedown", e => {
    e.preventDefault(); e.stopPropagation()
    if (!command.params.length) {
      command.exec(menu.pm)
      menu.reset()
    } else if (command.params.length == 1 && command.params[0].type == "select") {
      showSelectMenu(menu.pm, command, dom)
    } else {
      menu.enter(readParams(command))
    }
  })
  return dom
}

function resolveIcon(pm, command) {
  for (;;) {
    let icon = command.info.icon
    if (!icon) break
    if (icon.from) {
      command = pm.commands[icon.from]
      if (!command) break
    } else {
      return getIcon(command.name, icon)
    }
  }
  return elt("span", null, "?") // FIXME saner default?
}

function renderSelect(item, menu) {
  let param = item.params[0]
  let value = !param.default ? null : param.default.call ? param.default(menu.pm) : param.default

  let dom = elt("div", {class: "ProseMirror-select ProseMirror-select-command-" + item.name, title: item.label},
                !value ? (param.defaultLabel || "Select...") : value.display ? value.display(value) : value.label)
  dom.addEventListener("mousedown", e => {
    e.preventDefault(); e.stopPropagation()
    showSelectMenu(menu.pm, item, dom)
  })
  return dom
}

export function showSelectMenu(pm, item, dom) {
  let param = item.params[0]
  let options = param.options.call ? param.options(pm) : param.options
  let menu = elt("div", {class: "ProseMirror-select-menu"}, options.map(o => {
    let dom = elt("div", null, o.display ? o.display(o) : o.label)
    dom.addEventListener("mousedown", e => {
      e.preventDefault()
      item.exec(pm, [o.value])
      finish()
    })
    return dom
  }))
  let pos = dom.getBoundingClientRect(), box = pm.wrapper.getBoundingClientRect()
  menu.style.left = (pos.left - box.left - 2) + "px"
  menu.style.top = (pos.top - box.top - 2) + "px"

  let done = false
  function finish() {
    if (done) return
    done = true
    document.body.removeEventListener("mousedown", finish)
    document.body.removeEventListener("keydown", finish)
    pm.wrapper.removeChild(menu)
  }
  document.body.addEventListener("mousedown", finish)
  document.body.addEventListener("keydown", finish)
  pm.wrapper.appendChild(menu)
}

function renderItem(item, menu) {
  if (item.display == "icon") return renderIcon(item, menu)
  else if (item.display == "select") return renderSelect(item, menu)
  else if (!item.display) throw new Error("Command " + item.name + " can not be shown in a menu")
  else return item.display(menu)
}

function buildParamForm(pm, command) {
  let prefill = command.info.prefillParams && command.info.prefillParams(pm)
  let fields = command.params.map((param, i) => {
    let field, name = "field_" + i
    let val = prefill ? prefill[i] : param.default || ""
    if (param.type == "text")
      field = elt("input", {name, type: "text",
                            placeholder: param.name,
                            value: val,
                            autocomplete: "off"})
    else if (param.type == "select")
      field = elt("select", {name}, (param.options.call ? param.options(pm) : param.options)
                  .map(o => elt("option", {value: o.value, selected: o == val}, o.label)))
    else // FIXME more types
      throw new Error("Unsupported parameter type: " + param.type)
    return elt("div", null, field)
  })
  return elt("form", null, fields)
}

function gatherParams(pm, command, form) {
  let bad = false
  let params = command.params.map((param, i) => {
    let val = form.elements["field_" + i].value
    if (val) return val
    if (param.default == null) bad = true
    else return param.default.call ? param.default(pm) : param.default
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

export function readParams(command) {
  return {display(menu) {
    return paramForm(menu.pm, command, params => {
      menu.pm.focus()
      if (params) {
        command.exec(menu.pm, params)
        menu.reset()
      } else {
        menu.leave()
      }
    })
  }}
}

const separator = {
  display() { return elt("div", {class: "ProseMirror-menuseparator"}) }
}

export function commandGroups(pm, ...names) {
  return names.map(group => {
    let found = []
    for (let name in pm.commands) {
      let cmd = pm.commands[name]
      if (cmd.info.menuGroup && cmd.info.menuGroup == group)
        sortedInsert(found, cmd, (a, b) => (a.info.menuRank || 50) - (b.info.menuRank || 50))
    }
    return found
  })
}

function tooltipParamHandler(pm, command, callback) {
  let tooltip = new Tooltip(pm, "center")
  tooltip.open(paramForm(pm, command, params => {
    pm.focus()
    tooltip.close()
    callback(params)
  }))
}

defineParamHandler("default", tooltipParamHandler)
defineParamHandler("tooltip", tooltipParamHandler)

// FIXME check for obsolete styles
insertCSS(`

.ProseMirror-menu {
  margin: 0 -4px;
  line-height: 1;
  white-space: pre;
}
.ProseMirror-tooltip .ProseMirror-menu {
  width: -webkit-fit-content;
  width: fit-content;
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

.ProseMirror-menuicon {
  margin: 0 7px;
}

.ProseMirror-menuseparator {
  display: inline-block;
}
.ProseMirror-menuseparator:after {
  content: "︙";
  opacity: 0.5;
  padding: 0 4px;
  vertical-align: baseline;
}

.ProseMirror-select, .ProseMirror-select-menu {
  border: 1px solid #777;
  border-radius: 3px;
  font-size: 90%;
}

.ProseMirror-select {
  padding: 1px 12px 1px 4px;
  display: inline-block;
  vertical-align: middle;
  position: relative;
  cursor: pointer;
  margin: 0 8px;
}

.ProseMirror-select-command-textblockType {
  min-width: 3.2em;
}

.ProseMirror-select:after {
  content: "▿";
  color: #777;
  position: absolute;
  right: 4px;
}

.ProseMirror-select-menu {
  position: absolute;
  background: #444;
  color: white;
  padding: 2px 2px;
  z-index: 15;
}
.ProseMirror-select-menu div {
  cursor: pointer;
  padding: 0 1em 0 2px;
}
.ProseMirror-select-menu div:hover {
  background: #777;
}

`)
