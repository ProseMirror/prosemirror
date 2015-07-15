import {defineOption} from "../edit"
import {style, inline} from "../model"
import {elt} from "../dom"
import {Debounced} from "../util/debounce"

import {Tooltip} from "./tooltip"
import {InlineStyleItem, ImageItem, LinkDialog} from "./menuitem"
import {openMenu, forceFontLoad} from "./tooltip-menu"
import {MenuDefinition} from "./define"

import "./inlinetooltip_css"

const classPrefix = "ProseMirror-inlinetooltip"

defineOption("inlineTooltip", false, function(pm, value) {
  if (pm.mod.inlineTooltip)
    pm.mod.inlineTooltip.detach()
  if (value)
    pm.mod.inlineTooltip = new InlineTooltip(pm, value)
})

export const items = new MenuDefinition

items.addItem(new InlineStyleItem("bold", "Strong text", style.strong))
items.addItem(new InlineStyleItem("italic", "Emphasized text", style.em))
items.addItem(new InlineStyleItem("chain", "Hyperlink", "link", new LinkDialog))
items.addItem(new ImageItem("image"))
items.addItem(new InlineStyleItem("code", "Code font", style.code))

class InlineTooltip {
  constructor(pm, config) {
    this.pm = pm
    this.items = (config && config.items) || items.getItems()
    this.showLinks = config ? config.showLinks !== false : true
    this.debounced = new Debounced(pm, 100, () => this.update())

    pm.on("selectionChange", this.updateFunc = () => this.debounced.trigger())
    pm.on("change", this.updateFunc)
    pm.on("blur", this.updateFunc)

    this.tooltip = new Tooltip(pm, "above")
    this.tooltip.reset = this.updateFunc

    forceFontLoad(pm)
  }

  detach() {
    this.debounced.clear()
    this.tooltip.detach()

    this.pm.off("selectionChange", this.updateFunc)
    this.pm.off("change", this.updateFunc)
    this.pm.off("blur", this.updateFunc)
  }

  inPlainText(sel) {
    let start = this.pm.doc.path(sel.from.path)
    let end = this.pm.doc.path(sel.to.path)
    return start.type.plainText && end.type.plainText
  }

  update() {
    if (this.tooltip.active) return

    let sel = this.pm.selection, link
    if (!this.pm.hasFocus())
      this.tooltip.close()
    else if (!sel.empty && !this.inPlainText(sel))
      openMenu(this.tooltip, this.items, this.pm, topCenterOfSelection())
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
