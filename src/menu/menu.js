import {defineOption} from "../edit"
import {elt} from "../edit/dom"
import {resolvePath} from "../edit/selection"
import {Debounced} from "../util/debounce"

import {Tooltip} from "./tooltip"
import {openMenu, forceFontLoad} from "./tooltip-menu"
import {MenuDefinition} from "./define"

import "./menu_css"
import "./icons_css"

const classPrefix = "ProseMirror-menu"

defineOption("menu", false, function(pm, value) {
  if (pm.mod.blockTooltip)
    pm.mod.menu.detach()
  if (value)
    pm.mod.menu = new Menu(pm, value)
})

import {BlockTypeItem, LiftItem, WrapItem, InsertBlockItem, JoinItem, ImageItem} from "./menuitem"

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

items.addSub("insert", {icon: "plus", title: "Insert", collapsible: true})
items.addItem(new InsertBlockItem("minus", "Horizontal rule", "horizontal_rule"), {submenu: "insert"})
items.addItem(new ImageItem("image"), {submenu: "insert"})

items.addItem(new JoinItem("arrow-up"))

class Menu {
  constructor(pm, config) {
    this.pm = pm

    this.tooltip = new Tooltip(pm, "left")
    this.hamburger = pm.wrapper.appendChild(elt("div", {class: classPrefix + "-button"},
                                                elt("div"), elt("div"), elt("div")))
    this.hamburger.addEventListener("mousedown", e => { e.preventDefault(); e.stopPropagation(); this.openMenu() })

    this.debounced = new Debounced(pm, 100, () => this.alignButton())
    pm.on("selectionChange", this.updateFunc = () => this.updated())
    pm.on("change", this.updateFunc)

    this.menuItems = config && config.items || items.getItems()
    this.followCursor = config && config.followCursor

    forceFontLoad(pm)
  }

  detach() {
    this.debounced.clear()
    this.hamburger.parentNode.removeChild(this.hamburger)
    this.tooltip.detach()

    this.pm.off("selectionChange", this.updateFunc)
    this.pm.off("change", this.updateFunc)
  }

  updated() {
    if (!this.tooltip.active) {
      this.tooltip.close()
      this.debounced.trigger()
    }
  }

  openMenu() {
    let rect = this.hamburger.getBoundingClientRect()
    let pos = {left: rect.left, top: (rect.top + rect.bottom) / 2}
    openMenu(this.tooltip, this.menuItems.filter(i => i.select(this.pm)),
             this.pm, pos)
  }

  alignButton() {
    let blockElt = resolvePath(this.pm.content, this.pm.selection.from.path)
    let {top} = blockElt.getBoundingClientRect()
    let around = this.pm.wrapper.getBoundingClientRect()
    this.hamburger.style.top = Math.max(top - this.hamburger.offsetHeight - 2 - around.top, 7) + "px"
  }
}
