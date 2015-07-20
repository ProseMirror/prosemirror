import {defineOption} from "../edit"
import {elt} from "../dom"
import {Debounced} from "../util/debounce"

import {Menu} from "./menu"
import {items as inlineItems} from "./inlinetooltip"
import {items as blockItems} from "./buttonmenu"

import insertCSS from "insert-css"
import "./icons_css"

defineOption("menuBar", false, function(pm, value) {
  if (pm.mod.menuBar)
    pm.mod.menuBar.detach()
  if (value)
    pm.mod.menuBar = new MenuBar(pm, value)
})

const prefix = "ProseMirror-menubar"

class MenuBar {
  constructor(pm, config) {
    this.pm = pm
    this.menuElt = elt("div", {class: prefix + "-inner"})
    this.wrapper = elt("div", {class: prefix},
                       elt("ul", {class: "ProseMirror-menu", style: "visibility: hidden"},
                           elt("li", null, elt("span", {class: "ProseMirror-icon ProseMirror-icon-bold"}))),
                       this.menuElt)
    this.menu = new Menu(pm, this.menuElt, () => this.resetMenu())
    pm.wrapper.insertBefore(this.wrapper, pm.wrapper.firstChild)

    this.debounced = new Debounced(pm, 100, () => this.update())
    pm.on("selectionChange", this.updateFunc = () => this.debounced.trigger())
    pm.on("change", this.updateFunc)
    pm.on("activeStyleChange", this.updateFunc)

    this.menuItems = config && config.items || inlineItems.getItems().concat(blockItems.getItems())
    this.update()

    this.floating = false
    if (config && config.float) {
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
    this.debounced.clear()
    this.wrapper.parentNode.removeChild(this.wrapper)

    this.pm.off("selectionChange", this.updateFunc)
    this.pm.off("change", this.updateFunc)
    this.pm.off("activeStyleChange", this.updateFunc)
    if (this.scrollFunc)
      window.removeEventListener("scroll", this.scrollFunc)
  }

  update() {
    if (!this.menu.active) this.resetMenu()
    if (this.floating) this.scrollCursorIfNeeded()
  }
  resetMenu() {
    this.menu.open(this.menuItems)
  }

  updateFloat() {
    let editorRect = this.pm.wrapper.getBoundingClientRect()
    if (this.floating) {
      if (editorRect.top >= 0) {
        this.floating = false
        this.menuElt.style.position = this.menuElt.style.left = this.menuElt.style.width = ""
        this.menuElt.style.display = ""
      } else {
        let border = (this.pm.wrapper.offsetWidth - this.pm.wrapper.clientWidth) / 2
        this.menuElt.style.left = (editorRect.left + border) + "px"
        this.menuElt.style.display = (editorRect.top > window.innerHeight ? "none" : "")
      }
    } else {
      if (editorRect.top < 0) {
        this.floating = true
        let menuRect = this.menuElt.getBoundingClientRect()
        this.menuElt.style.left = menuRect.left + "px"
        this.menuElt.style.width = menuRect.width + "px"
        this.menuElt.style.position = "fixed"
      }
    }
  }

  scrollCursorIfNeeded() {
    let cursorPos = this.pm.coordsAtPos(this.pm.selection.head)
    let menuRect = this.menuElt.getBoundingClientRect()
    if (cursorPos.top < menuRect.bottom && cursorPos.bottom > menuRect.top) {
      let scrollable = findWrappingScrollable(this.pm.wrapper)
      if (scrollable) scrollable.scrollTop -= (menuRect.bottom - cursorPos.top)
    }
  }
}

function findWrappingScrollable(node) {
  for (let cur = node.parentNode; cur; cur = cur.parentNode)
    if (cur.scrollHeight > cur.clientHeight) return cur
}

insertCSS(`
.ProseMirror-menubar {
  padding: 1px 4px;
  position: relative;
  margin-bottom: 2px;
}

.ProseMirror-menubar-inner {
  color: #666;
  padding: 1px 4px;
  top: 0; left: 0; right: 0;
  position: absolute;
  border-bottom: 1px solid silver;
  background: white;
  -moz-box-sizing: border-box;
  box-sizing: border-box;
}

.ProseMirror-menubar .ProseMirror-menu-active {
  background: #eee;
}

.ProseMirror-menubar input[type="text"],
.ProseMirror-menubar textarea {
  background: #eee;
  color: black;
  border: none;
  outline: none;
  margin: 2px;
}

.ProseMirror-menubar input[type="text"] {
  padding: 0 4px;
}

`)
