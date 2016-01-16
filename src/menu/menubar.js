import {defineOption} from "../edit"
import {elt, insertCSS} from "../dom"
import {UpdateScheduler} from "../ui/update"

import {Menu, menuGroups} from "./menu"

const prefix = "ProseMirror-menubar"

// :: union<bool, Object> #path=menuBar #kind=option
//
// When given a truthy value, enables the menu bar module for this
// editor. The menu bar takes up space above the editor, showing
// currently available commands (that have been
// [added](#CommandSpec.menuGroup) to the menu). To configure the
// module, you can pass a configuration object, on which the following
// properties are supported:
//
// **`float`**`: bool = false`
//   : When enabled, causes the menu bar to stay visible when the
//     editor is partially scrolled out of view, by making it float at
//     the top of the viewport.
//
// **`groups`**`: [string] = ["inline", "insert", "block", "history"]`
//   : Determines the menu groups that are shown in the menu bar.
//
// **`items`**`: [union<string, [string]>]`
//   : Can be used to, rather than getting the commands to display
//     from menu groups, explicitly provide the full list of commands.
//     If nested arrays are used, separators will be shown between
//     items from different arrays.

defineOption("menuBar", false, function(pm, value) {
  if (pm.mod.menuBar) pm.mod.menuBar.detach()
  pm.mod.menuBar = value ? new MenuBar(pm, value) : null
})

function getItems(pm, items) {
  return Array.isArray(items)
         ? items.map(getItems.bind(null, pm)).filter(i => i)
         : pm.commands[items]
}

class BarDisplay {
  constructor(container) {
    this.container = container
  }
  clear() { this.container.textContent = "" }
  show(dom) {
    this.clear()
    this.container.appendChild(dom)
  }
  enter(dom, back) {
    this.container.firstChild.style.opacity = "0.5"

    let backButton = elt("div", {class: prefix + "-back"})
    backButton.addEventListener("mousedown", e => {
      e.preventDefault(); e.stopPropagation()
      back()
    })
    let added = elt("div", {class: prefix + "-sliding-wrap"},
                    elt("div", {class: prefix + "-sliding"}, backButton, dom))
    this.container.appendChild(added)
    added.lastChild.getBoundingClientRect() // Force layout for transition
    added.lastChild.style.left = "0"
  }
  leave() {
    let last = this.container.lastChild
    last.firstChild.style.pointerEvents = "none"
    last.lastChild.style.left = ""
    last.previousSibling.style.opacity = ""
    last.lastChild.addEventListener("transitionend", () => {
      this.container.removeChild(last)
    })
  }
}

class MenuBar {
  constructor(pm, config) {
    this.pm = pm
    this.config = config || {}

    this.wrapper = pm.wrapper.insertBefore(elt("div", {class: prefix}), pm.wrapper.firstChild)
    this.spacer = null
    this.maxHeight = 0
    this.widthForMaxHeight = 0

    this.updater = new UpdateScheduler(pm, "selectionChange change activeMarkChange commandsChanged", () => this.update())
    this.menu = new Menu(pm, new BarDisplay(this.wrapper), () => this.resetMenu())
    this.menu.cssHint = prefix + "-hint"

    this.updater.force()

    this.floating = false
    if (this.config.float) {
      this.updateFloat()
      this.scrollFunc = () => {
        if (!document.body.contains(this.pm.wrapper))
          window.removeEventListener("scroll", this.scrollFunc)
        else
          this.updateFloat()
      }
      window.addEventListener("scroll", this.scrollFunc)
    }
  }

  detach() {
    this.updater.detach()
    this.wrapper.parentNode.removeChild(this.wrapper)

    if (this.scrollFunc)
      window.removeEventListener("scroll", this.scrollFunc)
  }

  update() {
    if (!this.menu.active) this.resetMenu()
    return this.float ? this.updateScrollCursor() : () => {
      if (this.wrapper.offsetWidth != this.widthForMaxHeight) {
        this.widthForMaxHeight = this.wrapper.offsetWidth
        this.maxHeight = 0
      }
      if (this.wrapper.offsetHeight > this.maxHeight) {
        this.maxHeight = this.wrapper.offsetHeight
        return () => { this.wrapper.style.minHeight = this.maxHeight + "px" }
      }
    }
  }

  resetMenu() {
    this.menu.show(this.config.items
                   ? getItems(this.pm, this.config.items)
                   : menuGroups(this.pm, this.config.groups || ["inline", "insert", "block", "history"]))
  }

  updateFloat() {
    let editorRect = this.pm.wrapper.getBoundingClientRect()
    if (this.floating) {
      if (editorRect.top >= 0 || editorRect.bottom < this.wrapper.offsetHeight + 10) {
        this.floating = false
        this.wrapper.style.position = this.wrapper.style.left = this.wrapper.style.width = ""
        this.wrapper.style.display = ""
        this.spacer.parentNode.removeChild(this.spacer)
        this.spacer = null
      } else {
        let border = (this.pm.wrapper.offsetWidth - this.pm.wrapper.clientWidth) / 2
        this.wrapper.style.left = (editorRect.left + border) + "px"
        this.wrapper.style.display = (editorRect.top > window.innerHeight ? "none" : "")
      }
    } else {
      if (editorRect.top < 0 && editorRect.bottom >= this.wrapper.offsetHeight + 10) {
        this.floating = true
        let menuRect = this.wrapper.getBoundingClientRect()
        this.wrapper.style.left = menuRect.left + "px"
        this.wrapper.style.width = menuRect.width + "px"
        this.wrapper.style.position = "fixed"
        this.spacer = elt("div", {class: prefix + "-spacer", style: "height: " + menuRect.height + "px"})
        this.pm.wrapper.insertBefore(this.spacer, this.wrapper)
      }
    }
  }

  updateScrollCursor() {
    if (!this.floating) return null
    let head = this.pm.selection.head
    if (!head) return null
    return () => {
      let cursorPos = this.pm.coordsAtPos(head)
      let menuRect = this.wrapper.getBoundingClientRect()
      if (cursorPos.top < menuRect.bottom && cursorPos.bottom > menuRect.top) {
        let scrollable = findWrappingScrollable(this.pm.wrapper)
        if (scrollable)
          return () => { scrollable.scrollTop -= (menuRect.bottom - cursorPos.top) }
      }
    }
  }
}

function findWrappingScrollable(node) {
  for (let cur = node.parentNode; cur; cur = cur.parentNode)
    if (cur.scrollHeight > cur.clientHeight) return cur
}

insertCSS(`
.${prefix} {
  border-top-left-radius: inherit;
  border-top-right-radius: inherit;
  position: relative;
  min-height: 1em;
  color: #666;
  padding: 1px 6px;
  top: 0; left: 0; right: 0;
  border-bottom: 1px solid silver;
  background: white;
  z-index: 10;
  -moz-box-sizing: border-box;
  box-sizing: border-box;
  overflow: visible;
}

.${prefix} .ProseMirror-icon-active {
  background: #eee;
}

.ProseMirror-menuseparator {
  border-right: 1px solid #ddd;
}

.${prefix}-hint.ProseMirror-dropdown-menu {
  background: white;
  color: #666;
  border: 1px solid #ddd;
}

.${prefix}-hint.ProseMirror-dropdown-menu div:hover {
  background: #f2f2f2;
}

.${prefix} input[type="text"],
.${prefix} textarea {
  background: #eee;
  color: black;
  border: none;
  outline: none;
  width: 100%;
  box-sizing: -moz-border-box;
  box-sizing: border-box;
}

.${prefix} input[type="text"] {
  padding: 0 4px;
}

.${prefix} form {
  position: relative;
  padding: 2px 4px;
}

.${prefix} .ProseMirror-blocktype {
  border: 1px solid #ccc;
  min-width: 4em;
}

.${prefix}-sliding-wrap {
  position: absolute;
  left: 0; right: 0; top: 0;
  height: -webkit-fit-content;
  height: fit-content;
  overflow: hidden;
}

.${prefix}-sliding {
  -webkit-transition: left 0.2s ease-out;
  -moz-transition: left 0.2s ease-out;
  transition: left 0.2s ease-out;
  position: relative;
  left: 100%;
  width: 100%;
  box-sizing: -moz-border-box;
  box-sizing: border-box;
  padding-left: 16px;
  padding-right: 4px;
  background: white;
  border-bottom: 1px solid #ccc;
}

.${prefix}-back {
  position: absolute;
  height: 100%;
  margin-top: -1px;
  padding-bottom: 2px;
  width: 10px;
  left: 0;
  border-right: 1px solid silver;
  cursor: pointer;
  z-index: 1;
}
.${prefix}-back:after {
  content: "»";
}

`)
