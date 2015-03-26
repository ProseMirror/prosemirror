import {defineOption} from "../edit"
import {elt} from "../edit/dom"
import {Tooltip} from "./tooltip"
import {resolvePath} from "../edit/selection"
import {block, Node} from "../model"

import "./menu.css"

const classPrefix = "ProseMirror-menu"

defineOption("menu", false, function(pm, value) {
  if (pm.mod.blockTooltip)
    pm.mod.menu.detach()
  if (value)
    pm.mod.menu = new Menu(pm, value)
})

export class Item {
  constructor(icon, title) {
    this.icon = icon
    this.title = title
  }
  select() { return true }
}

export class LiftItem extends Item {
  constructor() {
    super("lift", "Move out of block")
  }
  select(pm) {
    let sel = pm.selection
    return block.canBeLifted(pm.doc, sel.from, sel.to)
  }
  apply(pm) {
    let sel = pm.selection
    pm.apply({name: "lift", pos: sel.from, end: sel.to})
  }
}

export class JoinItem extends Item {
  constructor() {
    super("join", "Join with above block")
  }
  select(pm) {
    return block.joinPoint(pm.doc, pm.selection.head)
  }
  apply(pm) {
    pm.apply({name: "join", pos: pm.selection.head})
  }
}

export class SubmenuItem extends Item {
  constructor(icon, title, submenu) {
    super(icon, title)
    this.submenu = submenu
  }
  select() { return this.submenu.length > 0 }
  apply() { return this.submenu }
}

export class BlockTypeItem extends Item {
  constructor(icon, title, type, attrs) {
    super(icon, title)
    this.type = type
    this.attrs = attrs
  }
  apply(pm) {
    let sel = pm.selection
    pm.apply({name: "setType", pos: sel.from, end: sel.to, type: this.type, attrs: this.attrs})
  }
}

export class InsertBlockItem extends Item {
  constructor(icon, title, type, attrs) {
    super(icon, title)
    this.type = type
    this.attrs = attrs
  }
  select(pm) {
    let sel = pm.selection
    return sel.empty && pm.doc.path(sel.path).type.type == Node.types[this.type].type
  }
  apply(pm) {
    let sel = pm.selection
    if (sel.head.offset) {
      pm.apply({name: "split", pos: sel.head})
      sel = pm.selection
    }
    pm.apply({name: "insert", pos: sel.head.shorten(), type: this.type, attrs: this.attrs})
  }
}

export class WrapItem extends Item {
  constructor(icon, title, type) {
    super(icon, title)
    this.type = type
  }
  apply(pm) {
    let sel = pm.selection
    pm.apply({name: "wrap", pos: sel.from, end: sel.to, type: this.type})
  }
}
    
export const defaultItems = [
  new SubmenuItem("paragraph", "Paragraph type", [
    new SubmenuItem("heading", "Heading", [
      new BlockTypeItem("heading-1", "Heading 1", "heading", {level: 1}),
      new BlockTypeItem("heading-2", "Heading 2", "heading", {level: 2}),
      new BlockTypeItem("heading-3", "Heading 3", "heading", {level: 3}),
      new BlockTypeItem("heading-4", "Heading 4", "heading", {level: 4}),
      new BlockTypeItem("heading-5", "Heading 5", "heading", {level: 5}),
      new BlockTypeItem("heading-6", "Heading 6", "heading", {level: 6}),
    ]),
    new BlockTypeItem("paragraph", "Normal paragraph", "paragraph"),
    new BlockTypeItem("code", "Code block", "code_block")
  ]),
  new LiftItem(),
  new SubmenuItem("wrap", "Wrap block", [
    new WrapItem("ordered-list", "Wrap in ordered list", "ordered_list"),
    new WrapItem("bullet-list", "Wrap in bullet list", "bullet_list"),
    new WrapItem("blockquote", "Wrap in blockquote", "blockquote")
  ]),
  new SubmenuItem("insert", "Insert", [
    new InsertBlockItem("insert-rule", "Horizontal rule", "horizontal_rule"),
    // FIXME insert image, allow dialog in this tooltip
  ]),
  new JoinItem()
]

class Menu {
  constructor(pm, config) {
    this.pm = pm

    this.tooltip = new Tooltip(pm, "left", true)
    this.hamburger = pm.wrapper.appendChild(elt("button", {class: classPrefix + "-button"},
                                                elt("div"), elt("div"), elt("div")))
    this.hamburger.addEventListener("mousedown", e => { e.preventDefault(); e.stopPropagation(); this.openMenu() })

    pm.on("selectionChange", this.updateFunc = () => this.updated())
    pm.on("change", this.updateFunc)
    this.scheduled = null

    this.menuItems = config && config.items || defaultItems
    this.followCursor = config && config.followCursor
  }

  detach() {
    this.hamburger.parentNode.removeChild(this.hamburger)
    this.tooltip.detach()

    pm.off("selectionChange", this.updateFunc)
    pm.off("change", this.updateFunc)
  }

  updated() {
    this.tooltip.close()
    if (this.menuItems) {
      window.clearTimeout(this.scheduled)
      this.scheduled = window.setTimeout(() => this.alignButton(), 100)
    }
  }

  select() {
    return this.menuItems.filter(i => i.select(this.pm))
  }

  renderItems(items) {
    let dom = elt("ul", {class: classPrefix})
    items.forEach(item => {
      let cls = classPrefix + "-icon " + classPrefix + "-" + item.icon
      let li = dom.appendChild(elt("li", {title: item.title}, elt("span", {class: cls})))
      li.addEventListener("mousedown", e => { e.preventDefault(); e.stopPropagation(); this.clickItem(item) })
    })
    return dom
  }

  openMenu() {
    let rect = this.hamburger.getBoundingClientRect()
    this.showItems(this.select(), rect.left, (rect.top + rect.bottom) / 2)
  }

  showItems(items, left, top) {
    let id = "menu-" + items.map(i => i.icon).join("-")
    this.tooltip.show(id, this.renderItems(items), left, top)
  }

  clickItem(item) {
    let result = item.apply(this.pm)
    if (result) {
      this.showItems(result)
    } else {
      this.tooltip.close()
      this.pm.focus()
    }
  }

  alignButton() {
    let blockElt = resolvePath(this.pm.content, this.pm.selection.from.path)
    let {top} = blockElt.getBoundingClientRect()
    let around = this.pm.wrapper.getBoundingClientRect()
    this.hamburger.style.top = Math.max(top - this.hamburger.offsetHeight - 2 - around.top, 7) + "px"
  }
}
