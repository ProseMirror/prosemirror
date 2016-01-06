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
// **`groups`**`: [string] = ["inline", "block", "history"]`
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
  return Array.isArray(items) ? items.map(getItems.bind(null, pm)) : pm.commands[items]
}

class BarDisplay {
  constructor(container, resetFunc) {
    this.container = container
    this.resetFunc = resetFunc
  }
  clear() { this.container.textContent = "" }
  reset() { this.resetFunc() }
  show(dom) {
    this.clear()
    this.container.appendChild(dom)
  }
  enter(dom, back) {
    let current = this.container.firstChild
    if (current) {
      current.style.position = "absolute"
      current.style.opacity = "0.5"
    }
    let backButton = elt("div", {class: prefix + "-back"})
    backButton.addEventListener("mousedown", e => {
      e.preventDefault(); e.stopPropagation()
      back()
    })
    let added = elt("div", {class: prefix + "-sliding"}, backButton, dom)
    this.container.appendChild(added)
    added.getBoundingClientRect() // Force layout for transition
    added.style.left = "0"
    added.addEventListener("transitionend", () => {
      if (current && current.parentNode) current.parentNode.removeChild(current)
    })
  }
}

class MenuBar {
  constructor(pm, config) {
    this.pm = pm
    this.config = config || {}

    this.menuElt = elt("div", {class: prefix + "-inner"})
    this.wrapper = elt("div", {class: prefix},
                       // Dummy structure to reserve space for the menu
                       elt("div", {class: "ProseMirror-menu", style: "visibility: hidden"},
                           elt("span", {class: "ProseMirror-menuicon"},
                               elt("div", {class: "ProseMirror-icon"}, "x"))),
                       this.menuElt)
    pm.wrapper.insertBefore(this.wrapper, pm.wrapper.firstChild)

    this.update = new UpdateScheduler(pm, "selectionChange change activeMarkChange commandsChanged", () => this.prepareUpdate())
    this.menu = new Menu(pm, new BarDisplay(this.menuElt, () => this.resetMenu()))

    this.update.force()

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
    this.update.detach()
    this.wrapper.parentNode.removeChild(this.wrapper)

    if (this.scrollFunc)
      window.removeEventListener("scroll", this.scrollFunc)
  }

  prepareUpdate() {
    let scrollCursor = this.prepareScrollCursor()
    return () => {
      if (!this.menu.active) this.resetMenu()
      if (scrollCursor) scrollCursor()
    }
  }

  resetMenu() {
    this.menu.show(this.config.items
                   ? getItems(this.pm, this.config.items)
                   : menuGroups(this.pm, this.config.groups || ["inline", "block", "history"]))
  }

  updateFloat() {
    let editorRect = this.pm.wrapper.getBoundingClientRect()
    if (this.floating) {
      if (editorRect.top >= 0 || editorRect.bottom < this.menuElt.offsetHeight + 10) {
        this.floating = false
        this.menuElt.style.position = this.menuElt.style.left = this.menuElt.style.width = ""
        this.menuElt.style.display = ""
      } else {
        let border = (this.pm.wrapper.offsetWidth - this.pm.wrapper.clientWidth) / 2
        this.menuElt.style.left = (editorRect.left + border) + "px"
        this.menuElt.style.display = (editorRect.top > window.innerHeight ? "none" : "")
      }
    } else {
      if (editorRect.top < 0 && editorRect.bottom >= this.menuElt.offsetHeight + 10) {
        this.floating = true
        let menuRect = this.menuElt.getBoundingClientRect()
        this.menuElt.style.left = menuRect.left + "px"
        this.menuElt.style.width = menuRect.width + "px"
        this.menuElt.style.position = "fixed"
      }
    }
  }

  prepareScrollCursor() {
    if (!this.floating) return null
    let head = this.pm.selection.head
    if (!head) return null
    let cursorPos = this.pm.coordsAtPos(head)
    let menuRect = this.menuElt.getBoundingClientRect()
    if (cursorPos.top < menuRect.bottom && cursorPos.bottom > menuRect.top) {
      let scrollable = findWrappingScrollable(this.pm.wrapper)
      if (scrollable)
        return () => scrollable.scrollTop -= (menuRect.bottom - cursorPos.top)
    }
  }
}

function findWrappingScrollable(node) {
  for (let cur = node.parentNode; cur; cur = cur.parentNode)
    if (cur.scrollHeight > cur.clientHeight) return cur
}

insertCSS(`
.${prefix} {
  position: relative;
  margin-bottom: 3px;
  border-top-left-radius: inherit;
  border-top-right-radius: inherit;
}

.${prefix}-inner {
  min-height: 1em;
  color: #666;
  padding: 1px 6px;
  top: 0; left: 0; right: 0;
  position: absolute;
  border-bottom: 1px solid silver;
  background: white;
  z-index: 10;
  -moz-box-sizing: border-box;
  box-sizing: border-box;
  overflow: hidden;
  border-top-left-radius: inherit;
  border-top-right-radius: inherit;
}

.${prefix} .ProseMirror-icon-active {
  background: #eee;
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
.${prefix} .ProseMirror-blocktype:after {
  color: #ccc;
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
  background: white;
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
}
.${prefix}-back:after {
  content: "«";
}

`)
