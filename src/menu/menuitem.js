import {style, inline, block, Node} from "../model"
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
    return block.canBeLifted(pm.doc, sel.from, sel.to)
  }
  apply(pm) {
    let sel = pm.selection
    pm.apply({name: "lift", pos: sel.from, end: sel.to})
  }
}

export class JoinItem extends Item {
  constructor(icon, title) {
    super(icon, title || "Join with above block")
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
    return sel.empty && pm.doc.path(sel.head.path).type.type == Node.types[this.type].type
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
      pm.apply({name: "removeStyle", pos: sel.from, end: sel.to, style: this.style.type})
    else if (this.dialog)
      return this.dialog
    else
      pm.apply({name: "addStyle", pos: sel.from, end: sel.to, style: this.style})
  }
}

export class ImageItem extends Item {
  constructor(icon, title) {
    super(icon, title || "Insert image")
  }
  apply(pm) { return new ImageDialog }
}

export class Dialog {
  constructor() {
    this.id = Math.floor(Math.random() * 0xffffff).toString(16)
  }

  focus(form) {
    let input = form.querySelector("input")
    if (input) input.focus()
  }

  buildForm(pm) {
    let form = this.form(pm)
    form.appendChild(elt("button", {type: "submit", style: "display: none"}))
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
    pm.apply({name: "addStyle", pos: sel.from, end: sel.to,
              style: style.link(elts.href.value, elts.title.value)})
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
    let sel = pm.selection
    pm.apply({name: "replace", pos: sel.from, end: sel.to})
    let attrs = {src: elts.src.value, alt: elts.alt.value, title: elts.title.value}
    pm.apply({name: "insertInline", pos: sel.from, type: "image", attrs: attrs})
  }
}
