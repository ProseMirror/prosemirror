import {defineOption} from "../edit"
import {style, inline, Node} from "../model"
import {elt} from "../edit/dom"
import {Tooltip} from "./tooltip"
import {InlineStyleItem, ImageItem, LinkDialog} from "./menuitem"
import {openMenu, forceFontLoad} from "./tooltip-menu"

import "./inlinetooltip.css"

const classPrefix = "ProseMirror-inlinetooltip"

defineOption("inlineTooltip", false, function(pm, value) {
  if (pm.mod.inlineTooltip)
    pm.mod.inlineTooltip.detach()
  if (value)
    pm.mod.inlineTooltip = new InlineTooltip(pm, value)
})

export const defaultItems = [
  new InlineStyleItem("bold", "Strong text", style.strong),
  new InlineStyleItem("italic", "Emphasized text", style.em),
  new InlineStyleItem("chain", "Hyperlink", "link", new LinkDialog),
  new ImageItem("image"),
  new InlineStyleItem("code", "Code font", style.code)
]

class InlineTooltip {
  constructor(pm, config) {
    this.pm = pm
    this.items = (config && config.items) || defaultItems
    this.showLinks = config ? config.showLinks !== false : true
    this.pending = null

    this.tooltip = new Tooltip(pm, "above")

    pm.on("selectionChange", this.updateFunc = () => this.scheduleUpdate())
    pm.on("change", this.updateFunc)

    forceFontLoad(pm)
  }

  detach() {
    this.tooltip.detach()
    
    pm.off("selectionChange", this.updateFunc)
    pm.off("change", this.updateFunc)
  }

  scheduleUpdate() {
    window.clearTimeout(this.pending)
    this.pending = window.setTimeout(() => {
      this.pending = null
      this.update()
    }, 100)
  }

  inCodeBlock(sel) {
    let start = this.pm.doc.path(sel.from.path)
    let end = this.pm.doc.path(sel.to.path)
    return start.type == Node.types.code_block && end.type == Node.types.code_block
  }

  update() {
    let sel = this.pm.selection, link
    if (!this.pm.hasFocus())
      this.tooltip.close()
    else if (!sel.empty && !this.inCodeBlock(sel))
      openMenu(this.tooltip, this.items, pm, topCenterOfSelection())
    else if (this.showLinks && (link = this.linkUnderCursor()))
      this.showLink(link, this.pm.coordsAtPos(sel.head))
    else
      this.tooltip.close()
  }

  linkUnderCursor() {
    let styles = inline.inlineStylesAt(this.pm.doc, this.pm.selection.head)
    return styles.reduce((found, st) => found || (st.type == "link" && st), null)
  }

  showLink(link, pos) {
    let node = elt("div", {class: classPrefix + "-linktext"}, elt("a", {href: link.href, title: link.title}, link.href))
    this.tooltip.show("link-" + link.href, node, pos)
  }
}

function topCenterOfSelection() {
  let rects = window.getSelection().getRangeAt(0).getClientRects()
  let {left, right, top} = rects[0]
  for (let i = 1; i < rects.length; i++) {
    if (rects[i].top < rects[0].bottom - 1 &&
        // Chrome bug where bogus rectangles are inserted at span boundaries
        (i == rects.length - 1 || Math.abs(rects[i + 1].left - rects[i].left) > 1)) {
      left = Math.min(left, rects[i].left)
      right = Math.max(right, rects[i].right)
      top = Math.min(top, rects[i].top)
    }
  }
  return {top, left: (left + right) / 2}
}
