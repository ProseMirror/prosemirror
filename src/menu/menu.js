import {elt, insertCSS} from "../dom"
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

function title(pm, command) {
  if (!command.label) return null
  let key = command.name && pm.keyForCommand(command.name)
  return key ? command.label + " (" + key + ")" : command.label
}

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
      cmd.exec(pm, null, dom)
    })
    return dom
  }
}

export class MenuCommandGroup {
  constructor(name, options) {
    this.name = name
    this.options = options
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

  get(pm) {
    let groups = pm.mod.menuGroups || this.startGroups(pm)
    return groups[this.name] || (groups[this.name] = this.collect(pm))
  }

  startGroups(pm) {
    let clear = () => {
      pm.mod.menuGroups = null
      pm.off("commandsChanging", clear)
    }
    pm.on("commandsChanging", clear)
    return pm.mod.menuGroups = Object.create(null)
  }
}

function getElements(content, pm) {
  let result
  for (let i = 0; i < content.length; i++) {
    let cur = content[i]
    if (cur instanceof MenuCommandGroup) {
      let elts = cur.get(pm)
      if (content.length == 1) return elts
      else result = (result || content.slice(0, i)).concat(elts)
    } else if (result) {
      result.push(cur)
    }
  }
  return result || content
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [value]
}

export function separator() {
  return elt("span", {class: prefix + "separator"})
}

export class GroupedMenu {
  constructor(groups) {
    this.groups = groups.map(ensureArray)
  }

  render(pm) {
    let result = document.createDocumentFragment(), needSep = false
    for (let i = 0; i < this.groups.length; i++) {
      let items = getElements(this.groups[i], pm), added = false
      for (let j = 0; j < items.length; j++) {
        let rendered = items[j].render(pm)
        if (rendered) {
          if (!added && needSep) result.appendChild(separator())
          result.appendChild(elt("span", {class: prefix + "item"}, rendered))
          added = true
        }
      }
      if (added) needSep = true
    }
    if (result.childNodes.length) return result
  }
}

export class Dropdown {
  constructor(options, content) {
    this.options = options || {}
    this.content = ensureArray(content)
  }

  render(pm) {
    if (getElements(this.content, pm).length == 0) return

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
    let rendered = renderDropdownItems(getElements(this.content, pm), pm)
    let box = dom.getBoundingClientRect(), outer = pm.wrapper.getBoundingClientRect()
    let menuDOM = elt("div", {class: prefix + "-dropdown-menu " + (this.options.className || ""),
                              style: "left: " + (box.left - outer.left) + "px; top: " + (box.bottom - outer.top) + "px"},
                      rendered)

    let done = false
    function finish() {
      if (done) return
      done = true
      document.body.removeEventListener("mousedown", finish)
      document.body.removeEventListener("keydown", finish)
      pm.off("menuReset", finish)
      pm.wrapper.removeChild(menuDOM)
      return true
    }
    pm.signal("menuReset")
    pm.wrapper.appendChild(menuDOM)

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
  let items = getElements(element.content, pm)
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
    this.content = ensureArray(content)
  }

  render(pm) {
    let items = getElements(this.content, pm)
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

.${prefix}-dropdown-menu, .${prefix}-submenu {
  position: absolute;
  background: white;
  color: #666;
  border: 1px solid #aaa;
  padding: 2px;
}

.${prefix}-dropdown-menu {
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
