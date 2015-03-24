import {defineOption} from "../edit"
import {elt} from "../edit/dom"
import {Tooltip} from "./tooltip"
import {resolvePath} from "../edit/selection"
import {block} from "../model"

import "./blocktooltip.css"

const classPrefix = "ProseMirror-blocktooltip"

defineOption("blockTooltip", false, function(pm, value) {
  if (pm.mod.blockTooltip)
    pm.mod.blockTooltip.detach()
  if (value)
    pm.mod.blockTooltip = new BlockTooltip(pm, value)
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
  new JoinItem()
]

class BlockTooltip {
  constructor(pm, config) {
    this.pm = pm
    this.tooltip = new Tooltip(pm, "right")
    this.line = pm.wrapper.appendChild(elt("div", {class: classPrefix + "-line"}))
    this.line.addEventListener("mousedown", e => { e.preventDefault(); this.clickLine(e) })
    this.pending = null

    this.menuItems = config && config.items || defaultItems

    pm.on("selectionChange", this.updateFunc = () => this.scheduleUpdate())
    pm.on("change", this.updateFunc = () => this.scheduleUpdate())
  }

  detach() {
    this.tooltip.detach()
    
    pm.off("selectionChange", this.updateFunc)
  }

  scheduleUpdate() {
    this.tooltip.close()
    window.clearTimeout(this.pending)
    this.pending = window.setTimeout(() => {
      this.pending = null
      this.update()
    }, 100)
  }

  update() {
    if (!this.pm.hasFocus()) this.hide()
    else this.showLine()
  }

  select() {
    return this.menuItems.filter(i => i.select(this.pm))
  }

  showLine() {
    let {top, bottom} = blockPosition(this.pm)
    top -= 2 // Compensate for the fact that fonts tend to have more space below than above
    let base = this.pm.wrapper.getBoundingClientRect()
    this.line.style.display = "block"
    this.line.style.top = (top - base.top) + "px"
    this.line.style.height = (bottom - top) + "px"
  }

  hide() {
    this.tooltip.close()
    this.line.style.display = ""
  }

  renderItems(items) {
    let dom = elt("ul", {class: classPrefix})
    items.forEach(item => {
      let cls = classPrefix + "-icon " + classPrefix + "-" + item.icon
      let li = dom.appendChild(elt("li", {title: item.title}, elt("span", {class: cls})))
      li.addEventListener("mousedown", e => { e.preventDefault(); this.clickItem(item) })
    })
    return dom
  }

  showItems(items, left, top) {
    let id = "blocktooltip-" + items.map(i => i.icon).join("-")
    this.tooltip.show(id, this.renderItems(items), left, top)
  }

  clickLine(e) {
    this.showItems(this.select(), e.clientX, e.clientY)
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
}

function blockPosition(pm) {
  let sel = pm.selection
  let topRect = resolvePath(pm.content, sel.from.path).getBoundingClientRect()
  let botRect = resolvePath(pm.content, sel.to.path).getBoundingClientRect()
  return {top: topRect.top, bottom: botRect.bottom}
}
