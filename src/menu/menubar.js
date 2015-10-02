import {defineOption} from "../edit"
import {elt} from "../dom"
import {Debounced} from "../util/debounce"

import {Menu} from "./menu"
import {getItems, separatorItem} from "./items"

import insertCSS from "insert-css"
import "./icons"

defineOption("menuBar", false, function(pm, value) {
  if (pm.mod.menuBar) pm.mod.menuBar.detach()
  pm.mod.menuBar = value ? new MenuBar(pm, value) : null
})

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
    let backButton = elt("div", {class: "ProseMirror-menubar-back"})
    backButton.addEventListener("mousedown", e => {
      e.preventDefault(); e.stopPropagation()
      back()
    })
    let added = elt("div", {class: "ProseMirror-menubar-sliding"}, backButton, dom)
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

    this.menuElt = elt("div", {class: "ProseMirror-menubar-inner"})
    this.wrapper = elt("div", {class: "ProseMirror-menubar"},
                       // Height-forcing placeholder
                       elt("div", {class: "ProseMirror-menu", style: "visibility: hidden"},
                           elt("div", {class: "ProseMirror-menuicon"},
                               elt("span", {class: "ProseMirror-menuicon ProseMirror-icon-strong"}))),
                       this.menuElt)
    pm.wrapper.insertBefore(this.wrapper, pm.wrapper.firstChild)

    this.menu = new Menu(pm, new BarDisplay(this.menuElt, () => this.resetMenu()))
    this.debounced = new Debounced(pm, 100, () => this.update())
    pm.on("selectionChange", this.updateFunc = () => this.debounced.trigger())
    pm.on("change", this.updateFunc)
    pm.on("activeStyleChange", this.updateFunc)

    this.menuItems = config && config.items ||
      [...getItems("inline"), separatorItem, ...getItems("block"), ...getItems("history")]
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
    this.menu.show(this.menuItems)
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
        this.menuElt.style.width = menuRect.length + "px"
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
  margin-bottom: 3px;
  border-top-left-radius: inherit;
  border-top-right-radius: inherit;
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
  overflow: hidden;
  border-top-left-radius: inherit;
  border-top-right-radius: inherit;
}

.ProseMirror-menubar .ProseMirror-menuicon-active {
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

.ProseMirror-menubar .ProseMirror-blocktype {
  border: 1px solid #ccc;
  min-width: 4em;
}
.ProseMirror-menubar .ProseMirror-blocktype:after {
  color: #ccc;
}

.ProseMirror-menubar-sliding {
  -webkit-transition: left 0.2s ease-out;
  -moz-transition: left 0.2s ease-out;
  transition: left 0.2s ease-out;
  position: relative;
  left: 100%;
  width: 100%;
  padding-left: 16px;
  background: white;
}

.ProseMirror-menubar-back {
  position: absolute;
  height: 100%;
  margin-top: -1px;
  padding-bottom: 2px;
  width: 10px;
  left: 0;
  border-right: 1px solid silver;
  cursor: pointer;
}
.ProseMirror-menubar-back:after {
  content: "«";
}

`)
