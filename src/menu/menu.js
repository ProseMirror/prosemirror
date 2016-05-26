import {elt, insertCSS} from "../dom"
import {undo, redo, lift, joinUp, selectParentNode} from "../edit/base_commands"

import {getIcon} from "./icons"

// !! This module defines a number of building blocks for ProseMirror
// menus, as consumed by the [`menubar`](#menu/menubar) and
// [`tooltipmenu`](#menu/tooltipmenu) modules.

// ;; #path=MenuElement #kind=interface
// The types defined in this module aren't the only thing you can
// display in your menu. Anything that conforms to this interface can
// be put into a menu structure.

// :: (pm: ProseMirror) → ?DOMNode #path=MenuElement.render
// Render the element for display in the menu. Returning `null` can be
// used to signal that this element shouldn't be displayed for the
// given editor state.

const prefix = "ProseMirror-menu"

function title(pm, title, _run) {
  let label = pm.translate(title)
  let key = null // FIXME pm.keyForCommand(_run)
  return key ? label + " (" + key + ")" : label
}

// ;; An icon or label that, when clicked, executes a command.
export class MenuItem {
  // :: (MenuItemSpec)
  constructor(spec) {
    // :: MenuItemSpec
    // The spec used to create the menu item.
    this.spec = spec
  }

  // :: (ProseMirror) → DOMNode
  // Renders the icon according to its [display
  // spec](#MenuItemSpec.display), and adds an event handler which
  // executes the command when the representation is clicked.
  render(pm) {
    let disabled = false, spec = this.spec
    if (spec.select && !spec.select(pm)) {
      if (spec.onDeselected == "disable") disabled = true
      else return null
    }
    let active = spec.active && !disabled && spec.active(pm)

    let dom
    if (spec.render) {
      dom = spec.render(pm)
    } else if (spec.icon) {
      dom = getIcon(spec.icon)
      if (active) dom.classList.add(prefix + "-active")
    } else if (spec.label) {
      dom = elt("div", null, pm.translate(spec.label))
    } else {
      throw new RangeError("MenuItem without render, icon, or label property")
    }

    if (spec.title) dom.setAttribute("title", title(pm, spec.title, spec.run))
    if (spec.class) dom.classList.add(spec.class)
    if (disabled) dom.classList.add(prefix + "-disabled")
    if (spec.css) dom.style.cssText += spec.css
    if (!disabled) dom.addEventListener(spec.execEvent || "mousedown", e => {
      e.preventDefault(); e.stopPropagation()
      pm.signal("interaction")
      spec.run(pm)
    })
    return dom
  }
}

// :: Object #path=MenuItemSpec #kind=interface
// The configuration object passed to the `MenuItem` constructor.

// :: (ProseMirror)
// The function to execute when the menu item is activated.

// :: ?(ProseMirror) → bool #path=MenuItemSpec.select
// Optional function that is used to determine whether the item is
// appropriate at the moment.

// :: ?string #path=MenuItemSpec.onDeselect
// Determines what happens when [`select`](#MenuItemSpec.select)
// returns false. The default is to hide the item, you can set this to
// `"disable"` to instead render the item with a disabled style.

// :: ?(ProseMirror) → bool #path=MenuItemSpec.active
// A predicate function to determine whether the item is 'active' (for
// example, the item for toggling the strong mark might be active then
// the cursor is in strong text).

// :: ?(ProseMirror) → DOMNode #path=MenuItemSpec.render
// A function that renders the item. You must provide either this,
// [`icon`](#MenuItemSpec.icon), or [`label`](#MenuItemSpec.label).

// :: ?Object #path=MenuItemSpec.icon
// Describes an icon to show for this item. The object may specify an
// SVG icon, in which case its `path` property should be an [SVG path
// spec](https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/d),
// and `width` and `height` should provide the viewbox in which that
// path exists. Alternatively, it may have a `text` property
// specifying a string of text that makes up the icon, with an
// optional `css` property giving additional CSS styling for the text.
// _Or_ it may contain `dom` property containing a DOM node.

// :: ?string #path=MenuItemSpec.label
// Makes the item show up as a text label. Mostly useful for items
// wrapped in a [drop-down](#Dropdown) or similar menu. The object
// should have a `label` property providing the text to display.

// :: ?string #path=MenuItemSpec.title
// Defines DOM title (mouseover) text for the item.

// :: string #path=MenuItemSpec.class
// Optionally adds a CSS class to the item's DOM representation.

// :: string #path=MenuItemSpec.css
// Optionally adds a string of inline CSS to the item's DOM
// representation.

// :: string #path=MenuItemSpec.execEvent
// Defines which event on the command's DOM representation should
// trigger the execution of the command. Defaults to mousedown.


// ;; A drop-down menu, displayed as a label with a downwards-pointing
// triangle to the right of it.
export class Dropdown {
  // :: ([MenuElement], ?Object)
  // Create a dropdown wrapping the elements. Options may include
  // the following properties:
  //
  // **`label`**`: string`
  //   : The label to show on the drop-down control.
  //
  // **`title`**`: string`
  //   : Sets the
  //     [`title`](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/title)
  //     attribute given to the menu control.
  //
  // **`class`**`: string`
  //   : When given, adds an extra CSS class to the menu control.
  //
  // **`css`**`: string`
  //   : When given, adds an extra set of CSS styles to the menu control.
  constructor(content, options) {
    this.options = options || {}
    this.content = Array.isArray(content) ? content : [content]
  }

  // :: (ProseMirror) → DOMNode
  // Returns a node showing the collapsed menu, which expands when clicked.
  render(pm) {
    let items = renderDropdownItems(this.content, pm)
    if (!items.length) return null

    let dom = elt("div", {class: prefix + "-dropdown " + (this.options.class || ""),
                          style: this.options.css,
                          title: this.options.title && pm.translate(this.options.title)},
                  pm.translate(this.options.label))
    let open = null
    dom.addEventListener("mousedown", e => {
      e.preventDefault(); e.stopPropagation()
      if (open && open()) open = null
      else open = this.expand(pm, dom, items)
    })
    return dom
  }

  expand(pm, dom, items) {
    let box = dom.getBoundingClientRect(), outer = pm.wrapper.getBoundingClientRect()
    let menuDOM = elt("div", {class: prefix + "-dropdown-menu " + (this.options.class || ""),
                              style: "left: " + (box.left - outer.left) + "px; top: " + (box.bottom - outer.top) + "px"},
                      items)

    let done = false
    function finish() {
      if (done) return
      done = true
      pm.off("interaction", finish)
      pm.wrapper.removeChild(menuDOM)
      return true
    }
    pm.signal("interaction")
    pm.wrapper.appendChild(menuDOM)
    pm.on("interaction", finish)
    return finish
  }
}

function renderDropdownItems(items, pm) {
  let rendered = []
  for (let i = 0; i < items.length; i++) {
    let inner = items[i].render(pm)
    if (inner) rendered.push(elt("div", {class: prefix + "-dropdown-item"}, inner))
  }
  return rendered
}

// ;; Represents a submenu wrapping a group of elements that start
// hidden and expand to the right when hovered over or tapped.
export class DropdownSubmenu {
  // :: ([MenuElement], ?Object)
  // Creates a submenu for the given group of menu elements. The
  // following options are recognized:
  //
  // **`label`**`: string`
  //   : The label to show on the submenu.
  constructor(content, options) {
    this.options = options || {}
    this.content = Array.isArray(content) ? content : [content]
  }

  // :: (ProseMirror) → DOMNode
  // Renders the submenu.
  render(pm) {
    let items = renderDropdownItems(this.content, pm)
    if (!items.length) return null

    let label = elt("div", {class: prefix + "-submenu-label"}, pm.translate(this.options.label))
    let wrap = elt("div", {class: prefix + "-submenu-wrap"}, label,
                   elt("div", {class: prefix + "-submenu"}, items))
    label.addEventListener("mousedown", e => {
      e.preventDefault(); e.stopPropagation()
      wrap.classList.toggle(prefix + "-submenu-wrap-active")
    })
    return wrap
  }
}

// :: (ProseMirror, [union<MenuElement, [MenuElement]>]) → ?DOMFragment
// Render the given, possibly nested, array of menu elements into a
// document fragment, placing separators between them (and ensuring no
// superfluous separators appear when some of the groups turn out to
// be empty).
export function renderGrouped(pm, content) {
  let result = document.createDocumentFragment(), needSep = false
  for (let i = 0; i < content.length; i++) {
    let items = content[i], added = false
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
  return result
}

function separator() {
  return elt("span", {class: prefix + "separator"})
}

// :: MenuItem
// Menu item for the `joinUp` command.
export const joinUpItem = new MenuItem({
  title: "Join with above block",
  run: joinUp,
  select: pm => joinUp(pm, false),
  icon: {
    width: 800, height: 900,
    path: "M0 75h800v125h-800z M0 825h800v-125h-800z M250 400h100v-100h100v100h100v100h-100v100h-100v-100h-100z"
  }
})

// :: MenuItem
// Menu item for the `lift` command.
export const liftItem = new MenuItem({
  title: "Lift out of enclosing block",
  run: lift,
  select: pm => lift(pm, false),
  icon: {
    width: 1024, height: 1024,
    path: "M219 310v329q0 7-5 12t-12 5q-8 0-13-5l-164-164q-5-5-5-13t5-13l164-164q5-5 13-5 7 0 12 5t5 12zM1024 749v109q0 7-5 12t-12 5h-987q-7 0-12-5t-5-12v-109q0-7 5-12t12-5h987q7 0 12 5t5 12zM1024 530v109q0 7-5 12t-12 5h-621q-7 0-12-5t-5-12v-109q0-7 5-12t12-5h621q7 0 12 5t5 12zM1024 310v109q0 7-5 12t-12 5h-621q-7 0-12-5t-5-12v-109q0-7 5-12t12-5h621q7 0 12 5t5 12zM1024 91v109q0 7-5 12t-12 5h-987q-7 0-12-5t-5-12v-109q0-7 5-12t12-5h987q7 0 12 5t5 12z"
  }
})

// :: MenuItem
// Menu item for the `selectParentNode` command.
export const selectParentNodeItem = new MenuItem({
  title: "Select parent node",
  run: selectParentNode,
  select: pm => selectParentNode(pm, false),
  icon: {text: "\u2b1a", css: "font-weight: bold"}
})

// :: MenuItem
// Menu item for the `undo` command.
export const undoItem = new MenuItem({
  title: "Undo last change",
  run: undo,
  select: pm => undo(pm, false),
  icon: {
    width: 1024, height: 1024,
    path: "M761 1024c113-206 132-520-313-509v253l-384-384 384-384v248c534-13 594 472 313 775z"
  }
})

// :: MenuItem
// Menu item for the `redo` command.
export const redoItem = new MenuItem({
  title: "Redo last undone change",
  run: redo,
  select: pm => redo(pm, false),
  icon: {
    width: 1024, height: 1024,
    path: "M576 248v-248l384 384-384 384v-253c-446-10-427 303-313 509-280-303-221-789 313-775z"
  }
})

insertCSS(`

.ProseMirror-textblock-dropdown {
  min-width: 3em;
}

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

.${prefix}-dropdown, .${prefix}-dropdown-menu {
  font-size: 90%;
  white-space: nowrap;
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

.${prefix}-active {
  background: #eee;
  border-radius: 4px;
}

.${prefix}-active {
  background: #eee;
  border-radius: 4px;
}

.${prefix}-disabled {
  opacity: .3;
}

.${prefix}-submenu-wrap:hover .${prefix}-submenu, .${prefix}-submenu-wrap-active .${prefix}-submenu {
  display: block;
}
`)
