import {defineOption} from "../edit"
import {elt} from "../dom"
import {resolvePath} from "../edit/selection"
import {Debounced} from "../util/debounce"

import {Tooltip} from "./tooltip"
import {Menu, forceFontLoad} from "./menu"
import {MenuDefinition} from "./define"

import insertCSS from "insert-css"
import "./icons_css"

const classPrefix = "ProseMirror-buttonmenu"

defineOption("buttonMenu", false, function(pm, value) {
  if (pm.mod.menu)
    pm.mod.menu.detach()
  if (value)
    pm.mod.menu = new ButtonMenu(pm, value)
})

import {BlockTypeItem, LiftItem, WrapItem, InsertBlockItem, JoinItem} from "./menuitem"

export const items = new MenuDefinition

items.addSub("paragraph", {icon: "paragraph", title: "Paragraph type"})
items.addSub("heading", {icon: "header", title: "Heading", parent: "paragraph"})
for (let i = 1; i <= 6; i++)
  items.addItem(new BlockTypeItem("" + i, "Heading " + i, "heading", {level: i}),
                {submenu: "heading"})
items.addItem(new BlockTypeItem("paragraph", "Normal paragraph", "paragraph"), {submenu: "paragraph"})
items.addItem(new BlockTypeItem("code", "Code block", "code_block"), {submenu: "paragraph"})

items.addItem(new LiftItem("dedent"))

items.addSub("wrap", {icon: "indent", title: "Wrap block"})
items.addItem(new WrapItem("list-ol", "Wrap in ordered list", "ordered_list"), {submenu: "wrap"})
items.addItem(new WrapItem("list-ul", "Wrap in bullet list", "bullet_list"), {submenu: "wrap"})
items.addItem(new WrapItem("quote-left", "Wrap in blockquote", "blockquote"), {submenu: "wrap"})

items.addItem(new InsertBlockItem("minus", "Horizontal rule", "horizontal_rule"))
items.addItem(new JoinItem("arrow-up"))

class ButtonMenu {
  constructor(pm, config) {
    this.pm = pm

    this.tooltip = new Tooltip(pm, "left")
    this.menu = Menu.fromTooltip(pm, this.tooltip)
    this.hamburger = pm.wrapper.appendChild(elt("div", {class: classPrefix + "-button"},
                                                elt("div"), elt("div"), elt("div")))
    this.hamburger.addEventListener("mousedown", e => { e.preventDefault(); e.stopPropagation(); this.openMenu() })

    this.debounced = new Debounced(pm, 100, () => this.alignButton())
    pm.on("selectionChange", this.updateFunc = () => this.updated())
    pm.on("change", this.updateFunc)

    this.menuItems = config && config.items || items.getItems()
    this.followCursor = config && config.followCursor

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
    this.menu.open(this.menuItems.filter(i => i.select(this.pm)), pos)
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
