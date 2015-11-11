import {defineOption} from "../edit"
import {elt, insertCSS} from "../dom"
import {resolvePath} from "../edit/selection"
import {Debounced} from "../util/debounce"

import {Tooltip} from "./tooltip"
import {Menu, TooltipDisplay, forceFontLoad, commandGroups} from "./menu"

import "./icons"

const classPrefix = "ProseMirror-buttonmenu"

defineOption("buttonMenu", false, function(pm, value) {
  if (pm.mod.menu) pm.mod.menu.detach()
  pm.mod.menu = value ? new ButtonMenu(pm, value) : null
})

class ButtonMenu {
  constructor(pm, _config) {
    this.pm = pm

    this.tooltip = new Tooltip(pm, "left")
    this.menu = new Menu(pm, new TooltipDisplay(this.tooltip))
    this.hamburger = pm.wrapper.appendChild(elt("div", {class: classPrefix + "-button"},
                                                elt("div"), elt("div"), elt("div")))
    this.hamburger.addEventListener("mousedown", e => {
      e.preventDefault(); e.stopPropagation()
      if (this.tooltip.isOpen) this.tooltip.close()
      else this.openMenu()
    })

    this.debounced = new Debounced(pm, 100, () => this.alignButton())
    pm.on("selectionChange", this.updateFunc = () => this.updated())
    pm.on("change", this.updateFunc)
    pm.on("blur", this.updateFunc)

    this.blockItems = commandGroups(pm, "block")
    this.allItems = commandGroups(pm, "inline", "block")

    this.pm.content.addEventListener("keydown", this.closeFunc = () => this.tooltip.close())
    this.pm.content.addEventListener("mousedown", this.closeFunc)

    forceFontLoad(pm)
  }

  detach() {
    this.debounced.clear()
    this.hamburger.parentNode.removeChild(this.hamburger)
    this.tooltip.detach()

    this.pm.off("selectionChange", this.updateFunc)
    this.pm.off("change", this.updateFunc)
    this.pm.off("blur", this.updateFunc)
    this.pm.content.removeEventListener("keydown", this.closeFunc)
    this.pm.content.removeEventListener("mousedown", this.closeFunc)
  }

  updated() {
    if (!this.menu.active) {
      this.tooltip.close()
      this.debounced.trigger()
    }
  }

  openMenu() {
    let rect = this.hamburger.getBoundingClientRect()
    let pos = {left: rect.left, top: (rect.top + rect.bottom) / 2}
    let showInline = this.pm.selection.empty || !this.pm.getOption("inlineMenu")
    this.menu.show(showInline ? this.allItems : this.blockItems, pos)
  }

  alignButton() {
    let blockElt = resolvePath(this.pm.content, this.pm.selection.from.path)
    let {top} = blockElt.getBoundingClientRect()
    let around = this.pm.wrapper.getBoundingClientRect()
    this.hamburger.style.top = Math.max(top - this.hamburger.offsetHeight - 2 - around.top, 7) + "px"
  }
}

insertCSS(`

.ProseMirror-buttonmenu-button {
  display: none;
  position: absolute;
  top: 7px;
  right: 7px;
  width: 15px;
  height: 13px;
  cursor: pointer;

  -webkit-transition: top 0.3s ease-out;
  -moz-transition: top 0.3s ease-out;
  transition: top 0.3s ease-out;
}

.ProseMirror-focused .ProseMirror-buttonmenu-button {
  display: block;
}

.ProseMirror-buttonmenu-button div {
  height: 3px;
  margin-bottom: 2px;
  border-radius: 4px;
  background: #888;
}

.ProseMirror-buttonmenu-button:hover div {
  background: #333;
}

`)
