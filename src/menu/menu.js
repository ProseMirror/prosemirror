import {defineOption} from "../edit"
import {elt} from "../edit/dom"
import {Tooltip} from "./tooltip"
import {resolvePath} from "../edit/selection"
import {block, Node} from "../model"
import {openMenu, forceFontLoad} from "./tooltip-menu"

import "./menu.css"
import "./icons.css"

const classPrefix = "ProseMirror-menu"

defineOption("menu", false, function(pm, value) {
  if (pm.mod.blockTooltip)
    pm.mod.menu.detach()
  if (value)
    pm.mod.menu = new Menu(pm, value)
})

import {SubmenuItem, BlockTypeItem, LiftItem, WrapItem, InsertBlockItem, JoinItem, ImageItem} from "./menuitem"

const headingItems = []
for (let i = 1; i <= 6; i++)
  headingItems.push(new BlockTypeItem("" + i, "Heading " + i, "heading", {level: i}))

export const defaultItems = [
  new SubmenuItem("paragraph", "Paragraph type", [
    new SubmenuItem("header", "Heading", headingItems),
    new BlockTypeItem("paragraph", "Normal paragraph", "paragraph"),
    new BlockTypeItem("code", "Code block", "code_block")
  ]),
  new LiftItem("dedent"),
  new SubmenuItem("indent", "Wrap block", [
    new WrapItem("list-ol", "Wrap in ordered list", "ordered_list"),
    new WrapItem("list-ul", "Wrap in bullet list", "bullet_list"),
    new WrapItem("quote-left", "Wrap in blockquote", "blockquote")
  ]),
  new SubmenuItem("plus", "Insert", [
    new InsertBlockItem("minus", "Horizontal rule", "horizontal_rule"),
    new ImageItem("image")
  ]),
  new JoinItem("arrow-up")
]

class Menu {
  constructor(pm, config) {
    this.pm = pm

    this.tooltip = new Tooltip(pm, "left")
    this.hamburger = pm.wrapper.appendChild(elt("div", {class: classPrefix + "-button"},
                                                elt("div"), elt("div"), elt("div")))
    this.hamburger.addEventListener("mousedown", e => { e.preventDefault(); e.stopPropagation(); this.openMenu() })

    pm.on("selectionChange", this.updateFunc = () => this.updated())
    pm.on("change", this.updateFunc)
    this.scheduled = null

    this.menuItems = config && config.items || defaultItems
    this.followCursor = config && config.followCursor

    forceFontLoad(pm)
  }

  detach() {
    this.hamburger.parentNode.removeChild(this.hamburger)
    this.tooltip.detach()

    pm.off("selectionChange", this.updateFunc)
    pm.off("change", this.updateFunc)
  }

  updated() {
    this.tooltip.close()
    if (this.followCursor) {
      window.clearTimeout(this.scheduled)
      this.scheduled = window.setTimeout(() => this.alignButton(), 100)
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
