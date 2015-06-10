import {style, inline, Node} from "../model"
import {canLift, canWrap, joinPoint} from "../transform"
import {elt} from "../edit/dom"

export class Item {
  constructor(icon, title) {
    this.icon = icon
    this.title = title
  }
  active() { return false }
  select() { return true }
}

export class LiftItem extends Item {
  constructor(icon, title) {
    super(icon, title || "Move out of block")
  }
  select(pm) {
    let sel = pm.selection
    return canLift(pm.doc, sel.from, sel.to)
  }
  apply(pm) {
    let sel = pm.selection
    pm.apply(pm.tr.lift(sel.from, sel.to))
  }
}

export class JoinItem extends Item {
  constructor(icon, title) {
    super(icon, title || "Join with above block")
  }
  select(pm) {
    return joinPoint(pm.doc, pm.selection.head)
  }
  apply(pm) {
    pm.apply(pm.tr.join(joinPoint(pm.doc, pm.selection.head)))
  }
}

export class SubmenuItem extends Item {
  constructor(icon, title, submenu) {
    super(icon, title)
    this.submenu = submenu || []
  }
  select(pm) { return this.submenu.some(i => i.select(pm)) }
  apply(pm) { return this.submenu.filter(i => i.select(pm)) }
}

export class BlockTypeItem extends Item {
  constructor(icon, title, type, attrs) {
    super(icon, title)
    this.type = type
    this.attrs = attrs
  }
  apply(pm) {
    let sel = pm.selection
    pm.apply(pm.tr.setBlockType(sel.from, sel.to, new Node(this.type, this.attrs)))
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
    return sel.empty && pm.doc.path(sel.head.path).type.type == Node.types[this.type].type
  }
  apply(pm) {
    let sel = pm.selection, tr = pm.tr, off = 0
    if (sel.head.offset) {
      tr.split(sel.head)
      off = 1
    }
    pm.apply(tr.insert(sel.head.shorten(null, off), new Node(this.type, this.attrs)))
  }
}

export class WrapItem extends Item {
  constructor(icon, title, type) {
    super(icon, title)
    this.type = type
  }
  select(pm) {
    return canWrap(pm.doc, pm.selection.from, pm.selection.to, new Node(this.type))
  }
  apply(pm) {
    let sel = pm.selection
    pm.apply(pm.tr.wrap(sel.from, sel.to, new Node(this.type)))
  }
}

export class InlineStyleItem extends Item {
  constructor(icon, title, style, dialog) {
    super(icon, title)
    this.style = typeof style == "string" ? {type: style} : style
    this.dialog = dialog
  }
  active(pm) {
    let sel = pm.selection
    return inline.rangeHasInlineStyle(pm.doc, sel.from, sel.to, this.style.type)
  }
  apply(pm) {
    let sel = pm.selection
    if (this.active(pm))
      pm.apply(pm.tr.removeStyle(sel.from, sel.to, this.style.type))
    else if (this.dialog)
      return this.dialog
    else
      pm.apply(pm.tr.addStyle(sel.from, sel.to, this.style))
  }
}

export class ImageItem extends Item {
  constructor(icon, title) {
    super(icon, title || "Insert image")
  }
  apply() { return new ImageDialog }
}

export class Dialog {
  constructor() {
    this.id = Math.floor(Math.random() * 0xffffff).toString(16)
  }

  focus(form) {
    let input = form.querySelector("input, textarea")
    if (input) input.focus()
  }

  buildForm(pm, submit) {
    let form = this.form(pm, submit)
    return form
  }
}

export class LinkDialog extends Dialog {
  form() {
    return elt("form", null,
               elt("div", null, elt("input", {name: "href", type: "text", placeholder: "Target URL",
                                              size: 40, autocomplete: "off"})),
               elt("div", null, elt("input", {name: "title", type: "text", placeholder: "Title",
                                              size: 40, autocomplete: "off"})))
  }

  apply(form, pm) {
    let elts = form.elements
    if (!elts.href.value) return
    let sel = pm.selection
    pm.apply(pm.tr.addStyle(sel.from, sel.to, style.link(elts.href.value, elts.title.value)))
  }
}

export class ImageDialog extends Dialog {
  form(pm) {
    let alt = pm.selectedText
    return elt("form", null,
               elt("div", null, elt("input", {name: "src", type: "text", placeholder: "Image URL",
                                              size: 40, autocomplete: "off"})),
               elt("div", null, elt("input", {name: "alt", type: "text", value: alt, autocomplete: "off",
                                              placeholder: "Description / alternative text", size: 40})),
               elt("div", null, elt("input", {name: "title", type: "text", placeholder: "Title",
                                              size: 40, autcomplete: "off"})))
  }

  apply(form, pm) {
    let elts = form.elements
    if (!elts.src.value) return
    let sel = pm.selection, tr = pm.tr
    tr.delete(sel.from, sel.to)
    let attrs = {src: elts.src.value, alt: elts.alt.value, title: elts.title.value}
    pm.apply(tr.insertInline(sel.from, new Node.Inline("image", attrs, null, null)))
  }
}
